import datetime
import email.utils
import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor

import requests
import sentry_sdk
import yt_dlp
from dotenv import load_dotenv

from ai_manager import AIGenerationError, AIManager, AIRateLimitError
from audio_processor import AudioProcessor
from logger import setup_logging
from metrics import (
    ai_failure_counter,
    ai_rate_limited_counter,
    attempt_counter,
    failure_counter,
    filtered_items_counter,
    skipped_counter,
    success_counter,
    sync_run_counter,
)
from rate_limiter import RateLimiter
from rss_generator import RSSGenerator
from s3_manager import S3Manager
from title_formatter import get_safe_title
from title_matcher import is_thero_in_content, load_thero_data
from transcript_service import get_transcript_text

logger = logging.getLogger(__name__)
load_dotenv()

# Default rate limit when not specified in config (effectively unlimited)
DEFAULT_MAX_VIDEOS_PER_DAY = 999
DEFAULT_MAX_AI_CALLS_PER_DAY = 10
# HTTP request timeout in seconds
HTTP_REQUEST_TIMEOUT = 60


class PodcastSync:
    def __init__(self, thero_config):
        self.config = thero_config
        self.thero_id = thero_config["id"]
        self.blocklist = set(thero_config.get("blocklist", []))
        self.thero_name = thero_config.get("name", self.thero_id)
        self.podcast_config = thero_config["podcast"]
        self.ai_config = thero_config.get("ai_config", {"enabled": False})
        self.sync_config = thero_config.get(
            "sync_config", {"max_videos_per_day": DEFAULT_MAX_VIDEOS_PER_DAY}
        )

        # S3 Setup via Composition
        s3_conf = thero_config["s3"]
        self.s3 = S3Manager(
            endpoint=os.getenv(s3_conf["endpoint_env"]),
            bucket=os.getenv(s3_conf["bucket_env"]),
            access_key=os.getenv(s3_conf["access_key_env"]),
            secret_key=os.getenv(s3_conf["secret_key_env"]),
        )
        self.base_url = f"{self.s3.endpoint}/{self.s3.bucket}"

        # Audio Setup via Composition
        self.audio = AudioProcessor(self.thero_name)

        # AI Manager Setup
        self.ai_manager = AIManager(self.s3) if self.ai_config.get("enabled") else None

        # Rate Limiting State (delegated to RateLimiter)
        self.state_file = "sync_state.json"
        # Initialise RateLimiter which loads and manages persisted state
        self.rate_limiter = RateLimiter(
            self.s3,
            self.state_file,
            self.sync_config.get("max_videos_per_day", DEFAULT_MAX_VIDEOS_PER_DAY),
            self.sync_config.get("max_ai_calls_per_day", DEFAULT_MAX_AI_CALLS_PER_DAY),
        )

    def _get_pub_date(self, info):
        upload_timestamp = info.get("timestamp")
        if upload_timestamp:
            return email.utils.formatdate(upload_timestamp, usegmt=True)
        elif info.get("upload_date"):
            try:
                dt = datetime.datetime.strptime(info["upload_date"], "%Y%m%d")
                dt = dt.replace(tzinfo=datetime.timezone.utc)
                return email.utils.format_datetime(dt)
            except ValueError:
                pass
        return email.utils.formatdate(usegmt=True)

    def _parse_time_to_seconds(self, time_str):
        """Converts HH:MM:SS string to seconds (float)."""
        try:
            parts = list(map(int, time_str.split(":")))
            if len(parts) == 3:
                return parts[0] * 3600 + parts[1] * 60 + parts[2]
            elif len(parts) == 2:
                return parts[0] * 60 + parts[1]
            else:
                return 0
        except ValueError:
            return 0

    def download_and_process(self, video_url):
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": "%(id)s_raw.%(ext)s",
            "quiet": True,
            "no_warnings": True,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "ios", "web_embedded"],
                    "js_runtime": "node",
                }
            },
        }
        raw_file = None
        mp3_file = None
        img_file = None
        transcript_path = None

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                metadata = {
                    "id": None,
                    "title": None,
                    "original_url": None,
                    "s3_audio_url": None,
                    "s3_image_url": None,
                    "pub_date": None,
                    "length_bytes": 0,
                    "duration": 0,
                    "title_match": True,
                    "ai_response": None,
                }

                # First extract info without downloading to check the title
                info = ydl.extract_info(video_url, download=False)

                metadata["id"] = info["id"]
                metadata["title"] = info.get("title", "No Title")
                metadata["original_url"] = video_url
                metadata["pub_date"] = self._get_pub_date(info)
                metadata["duration"] = info.get("duration", 0)

                # Title/Description filter check BEFORE download
                yt_description = info.get("description", "")
                if "matcher" in self.config and not is_thero_in_content(
                    metadata["title"], yt_description, self.config
                ):
                    logger.info(
                        f"[{self.thero_name}] Skipping {metadata['id']}: Title mismatch. Saving ignore record."
                    )
                    # Metadata for ignored video
                    metadata["title_match"] = False
                    skipped_counter.labels(
                        thero=self.thero_id, reason="title_mismatch"
                    ).inc()
                    return metadata

                # AI Metadata Generation (Before Download)
                if self.ai_manager:
                    metadata["ai_response"] = self._get_ai_metadata(
                        metadata["id"], video_url, transcript_path
                    )

                    # Common processing for both cached and new responses
                    if metadata["ai_response"]:
                        # Validate and format title
                        metadata["ai_response"]["title"] = get_safe_title(
                            metadata["title"], metadata["ai_response"]
                        )

                mp3_file, img_file = (
                    f"{metadata['id']}.mp3",
                    f"{metadata['id']}.jpg",
                )

                # Check if we should skip audio processing
                is_podcast_friendly = True
                if (
                    metadata["ai_response"]
                    and metadata["ai_response"].get("podcast_friendly") is False
                ):
                    is_podcast_friendly = False
                    logger.info(
                        f"[{self.thero_name}] Video {metadata['id']} is not podcast-friendly. Skipping audio processing."
                    )
                    skipped_counter.labels(
                        thero=self.thero_id, reason="not_podcast_friendly"
                    ).inc()

                    return metadata

                if is_podcast_friendly:
                    # Now download because the title matched and it's podcast friendly
                    logger.info(
                        f"[{self.thero_name}] Downloading audio: {metadata['id']}"
                    )
                    ydl.download([video_url])
                    raw_file = ydl.prepare_filename(info)

                    # Audio Conversion
                    logger.info(
                        f"[{self.thero_name}] Processing audio: {metadata['id']}"
                    )
                    self.audio.convert_to_mp3(raw_file, mp3_file)

                    # Upload Audio
                    logger.info(f"[{self.thero_name}] Uploading MP3: {metadata['id']}")
                    self.s3.upload_file(mp3_file, mp3_file, "audio/mpeg")
                    metadata["s3_audio_url"] = f"{self.base_url}/{mp3_file}"
                    metadata["length_bytes"] = os.path.getsize(mp3_file)

                    # Thumbnail
                    thumb_url = info.get("thumbnail")
                    if thumb_url:
                        try:
                            with requests.get(
                                thumb_url, stream=True, timeout=HTTP_REQUEST_TIMEOUT
                            ) as r:
                                if r.status_code == 200:
                                    with open(img_file, "wb") as f:
                                        for chunk in r.iter_content(1024):
                                            f.write(chunk)
                                    self.s3.upload_file(
                                        img_file, img_file, "image/jpeg"
                                    )
                                metadata["s3_image_url"] = f"{self.base_url}/{img_file}"
                        except Exception as e:
                            logger.error(f"[{self.thero_name}] Thumbnail error: {e}")

                return metadata

        finally:
            for f in [raw_file, mp3_file, img_file, transcript_path]:
                if f and os.path.exists(f):
                    os.remove(f)

    def _is_sync_allowed(self) -> bool:
        """Check all rate limits before processing a video.

        Returns True if sync is allowed, False otherwise.
        Logs the reason and increments metrics when rate-limited.
        """
        # Check daily video limit
        if not self.rate_limiter.can_sync_daily():
            logger.info(
                f"[{self.thero_name}] Daily sync limit reached ({self.rate_limiter.max_per_day}). Stopping sync."
            )
            skipped_counter.labels(thero=self.thero_id, reason="daily_limit").inc()
            return False

        # Check periodic video limit
        can_sync, wait_min = self.rate_limiter.can_sync_periodic()
        if not can_sync:
            logger.info(
                f"[{self.thero_name}] Sync limited; waiting {wait_min} minutes before next attempt."
            )
            skipped_counter.labels(thero=self.thero_id, reason="periodic_limit").inc()
            return False

        # Check AI rate limits if AI is enabled (AI is mandatory when enabled)
        if self.ai_manager:
            if not self.rate_limiter.can_ai_call_daily():
                logger.info(
                    f"[{self.thero_name}] Daily AI call limit reached ({self.rate_limiter.max_ai_calls_per_day}). Stopping sync."
                )
                skipped_counter.labels(
                    thero=self.thero_id, reason="ai_daily_limit"
                ).inc()
                return False

            can_ai_call, ai_wait_min = self.rate_limiter.can_ai_call_periodic()
            if not can_ai_call:
                logger.info(
                    f"[{self.thero_name}] AI rate limited; waiting {ai_wait_min} minutes before next attempt."
                )
                skipped_counter.labels(
                    thero=self.thero_id, reason="ai_periodic_limit"
                ).inc()
                return False

        return True

    def _is_valid_episode(self, metadata):
        ai_resp = metadata.get("ai_response") or {}
        # Check podcast friendly status (default True)
        is_friendly = ai_resp.get("podcast_friendly", True)
        # Check title match status (default True)
        is_match = metadata.get("title_match", True)

        return is_friendly is not False and is_match is not False

    def _get_ai_metadata(self, video_id, video_url, transcript_path=None):
        # Check cache first
        cached_response = self.ai_manager.get_cached_response(video_id)

        if cached_response:
            logger.info(f"[{self.thero_name}] Using cached AI metadata for {video_id}.")
            return cached_response

        logger.info(f"[{self.thero_name}] Generating AI metadata for {video_id}...")
        try:
            response = self.ai_manager.generate_metadata(video_url, transcript_path)

            if response:
                # Validate and clean
                response = self._validate_ai_response(response)
                logger.info(
                    f"[{self.thero_name}] AI metadata generated and validated for {video_id}."
                )
                self.ai_manager.cache_response(video_id, response)
                return response
            raise AIGenerationError("AI metadata generation returned empty response")
        except AIRateLimitError as e:
            logger.warning(f"[{self.thero_name}] AI Rate Limit reached: {e}")
            ai_rate_limited_counter.labels(thero=self.thero_id).inc()
            raise
        except AIGenerationError as e:
            logger.error(
                f"[{self.thero_name}] AI Generation failed for {video_id}: {e}"
            )
            ai_failure_counter.labels(thero=self.thero_id).inc()
            raise
        finally:
            # Record AI call whether it succeeds or fails (API quota is consumed)
            self.rate_limiter.record_ai_call()

    def _validate_ai_response(self, response):
        """
        Validates and cleans the AI response.
        Returns the cleaned response dictionary.
        Raises AIGenerationError if validation fails.
        """
        # Handle list response from Gemini (take first element if it's a list)
        if isinstance(response, list):
            if response and isinstance(response[0], dict):
                logger.info(
                    f"[{self.thero_name}] AI returned a list, using first element."
                )
                response = response[0]
            else:
                raise AIGenerationError(
                    f"AI returned an empty or invalid list: {response}"
                )

        # Schema Validation
        if not isinstance(response, dict):
            raise AIGenerationError(
                f"AI returned non-dict response type: {type(response)}"
            )

        required_keys = ["podcast_friendly", "title_components", "description"]
        if not all(k in response for k in required_keys):
            missing = [k for k in required_keys if k not in response]
            raise AIGenerationError(f"AI response missing required keys: {missing}")

        title_comps = response.get("title_components")
        if not isinstance(title_comps, dict):
            raise AIGenerationError("title_components is not a dict")

        tc_keys = ["series_name", "episode_number", "topic_summary"]
        if not all(k in title_comps for k in tc_keys):
            missing_tc = [k for k in tc_keys if k not in title_comps]
            raise AIGenerationError(f"title_components missing keys: {missing_tc}")

        # Validate Chapters if present
        chapters = response.get("chapters")
        if chapters:
            if not isinstance(chapters, list):
                raise AIGenerationError("chapters must be a list")

            for idx, ch in enumerate(chapters):
                if not isinstance(ch, dict):
                    raise AIGenerationError(f"chapter at index {idx} is not a dict")

                if "start_time" not in ch or "title" not in ch:
                    raise AIGenerationError(
                        f"chapter at index {idx} missing required fields"
                    )

                # strict HH:MM:SS validation
                if not re.match(r"^\d{2}:\d{2}:\d{2}$", ch["start_time"]):
                    raise AIGenerationError(
                        f"chapter at index {idx} has invalid start_time format: {ch['start_time']}"
                    )

        return response

    def _get_formatted_chapters(self, ai_response):
        """
        Extracts, formats, and sorts chapters from an AI response.
        Enforces 00:00:00 start time.
        Returns a dictionary suitable for assignment to metadata["chapters"] or file dump.
        """
        chapters = ai_response.get("aligned_chapters")
        if not chapters or not isinstance(chapters, list):
            return None

        formatted_chapters = {"version": "1.2.0", "chapters": []}

        for ch in chapters:
            start = ch.get("start_time")
            # Normalize to HH:MM:SS if needed (handle MM:SS)
            if start and start.count(":") == 1:
                start = f"00:{start}"

            title = ch.get("title")
            is_qa = ch.get("isQ&A")
            description = ch.get("description")

            if start and title:
                if is_qa:
                    title = f"Q&A: {title}"

                chapter_data = {
                    "startTime": self._parse_time_to_seconds(start),
                    "title": title,
                    "description": description,
                    "is_qa": is_qa,
                    "start_time_str": start,  # Keep original string for display
                }
                formatted_chapters["chapters"].append(chapter_data)

        if not formatted_chapters["chapters"]:
            return None

        # Ensure sorted by time
        formatted_chapters["chapters"].sort(key=lambda x: x["startTime"])

        # Ensure first chapter starts at 0
        if formatted_chapters["chapters"][0]["startTime"] > 0:
            formatted_chapters["chapters"].insert(
                0,
                {
                    "startTime": 0,
                    "title": "Start",
                    "description": "",
                    "is_qa": False,
                    "start_time_str": "00:00:00",
                },
            )

        return formatted_chapters

    def _process_video_task(self, item):
        vid_id = item["id"]

        # Skip if we have a valid completion record
        if self.s3.file_exists(f"{vid_id}.json"):
            return None

        try:
            # Increment attempt counter for each video processed
            attempt_counter.labels(thero=self.thero_id).inc()
            metadata = self.download_and_process(item["url"])
            self.s3.save_metadata(metadata)
            self.rate_limiter.record_success()
            success_counter.labels(thero=self.thero_id).inc()

            return self._is_valid_episode(metadata)
        except Exception as e:
            logger.error(
                f"[{self.thero_name}] Error during download_and_process for {vid_id}: {e}",
                exc_info=True,
            )
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("video_id", vid_id)
                scope.set_tag("thero_id", self.thero_id)
                sentry_sdk.capture_exception(e)

            failure_counter.labels(thero=self.thero_id).inc()
            return False

    def sync(self):
        sync_run_counter.labels(thero=self.thero_id).inc()
        logger.info(f"[{self.thero_name}] Starting sync...")

        if not self._is_sync_allowed():
            logger.info(
                f"[{self.thero_name}] Sync not allowed due to rate limits, skipping."
            )
            return

        urls = self.config.get("youtube_channel_urls", []) or [
            self.config.get("youtube_channel_url")
        ]
        video_items = []

        with yt_dlp.YoutubeDL(
            {
                "extract_flat": True,
                "quiet": True,
                "no_warnings": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["android", "ios", "web_embedded"],
                        "js_runtime": "node",
                    }
                },
            }
        ) as ydl:
            for url in urls:
                if not url:
                    continue
                logger.info(f"[{self.thero_name}] Fetching videos from: {url}")
                try:
                    info = ydl.extract_info(url, download=False)
                    entries = info.get("entries", [])
                    logger.info(f"[{self.thero_name}] Found {len(entries)} videos.")
                    for entry in entries:
                        if entry and "id" in entry:
                            video_items.append(
                                {
                                    "id": entry["id"],
                                    "url": entry.get("url")
                                    or f"https://www.youtube.com/watch?v={entry['id']}",
                                    "title": entry.get("title"),
                                }
                            )
                except Exception as e:
                    logger.error(
                        f"[{self.thero_name}] Error fetching channel: {e}",
                        exc_info=True,
                    )

        # Process videos sequentially
        processed_videos = False
        for item in video_items:
            if not self._is_sync_allowed():
                break
            processed_videos = processed_videos or self._process_video_task(item)

        logger.info(f"[{self.thero_name}] Sync complete.")

    def refresh_rss(self):
        # Refresh RSS
        logger.info(f"[{self.thero_name}] Refreshing RSS feed...")
        metadata_keys = self.s3.list_metadata_files()
        logger.info(
            f"[{self.thero_name}] Found {len(metadata_keys)} metadata files in S3."
        )

        def process_metadata_item(key):
            res = self.s3.get_json(key)
            if res:
                # Regenerate description from current template to ensure consistency
                try:
                    original_title = res.get("original_title") or res.get("title")
                    description = ""

                    # Append AI description if available
                    ai_data = res.get("ai_response")
                    if ai_data and ai_data.get("description"):
                        description += ai_data["description"]

                    # Append Chapters
                    if ai_data and ai_data.get("aligned_chapters"):
                        # get from s3
                        formatted = self._get_formatted_chapters(ai_data)
                        if formatted:
                            res["chapters"] = formatted

                            if description != "":
                                description += "<br/><br/>"

                            # Append chapters to description
                            description += "<b>📌 දේශනාවේ ප්‍රධාන මාතෘකා:</b><br /><br/>"
                            for ch in formatted["chapters"]:
                                start_str = ch.get("start_time_str", "00:00:00")
                                line = f"<b>({start_str}) {ch.get('title')}</b>"

                                desc_text = ch.get("description")
                                if desc_text:
                                    line += f" - {desc_text}"

                                description += f"{line}<br /><br/>"

                    if description != "":
                        description += "<br/>"

                    desc_tmp = self.podcast_config["description_template"]
                    description += desc_tmp.format(
                        title=res.get("title"),
                        original_url=res.get("original_url"),
                        original_title=original_title,
                    )

                    res["description"] = description
                except Exception as e:
                    logger.error(
                        f"[{self.thero_name}] Error regenerating description for {key}: {e}",
                        exc_info=True,
                    )

                if res.get("id") in self.blocklist:
                    logger.info(
                        f"[{self.thero_name}] Skipping blocked video in RSS: {res.get('id')}"
                    )
                    return None

                return res

        with ThreadPoolExecutor(max_workers=self.s3.max_concurrency) as executor:
            items = [
                res
                for res in executor.map(process_metadata_item, metadata_keys)
                if res is not None
            ]

        def get_safe_pub_date(x):
            try:
                dt = email.utils.parsedate_to_datetime(x.get("pub_date", ""))
                if dt.tzinfo is None:
                    return dt.replace(tzinfo=datetime.timezone.utc)
                return dt
            except Exception:
                return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)

        logger.info(f"[{self.thero_name}] Sorting {len(items)} items by date...")
        items.sort(
            key=get_safe_pub_date,
            reverse=True,
        )

        # Filter out non-podcast friendly items if AI is enabled and flagged
        original_count = len(items)
        valid_items = []
        for item in items:
            if self._is_valid_episode(item):
                valid_items.append(item)
        items = valid_items
        if len(items) < original_count:
            count = original_count - len(items)
            logger.info(
                f"[{self.thero_name}] Filtered out {count} non-podcast friendly or non related items."
            )
            filtered_items_counter.labels(thero=self.thero_id).inc(count)

        rss_file = self.config.get("rss_filename", "podcast.xml")
        RSSGenerator.generate(self.config, items, self.base_url, rss_file)
        self.s3.upload_file(rss_file, rss_file, "application/xml")
        if os.path.exists(rss_file):
            os.remove(rss_file)
        logger.info(f"[{self.thero_name}] RSS refresh complete.")

    def align_all_chapters(self):
        """
        Iterates through all metadata files and runs alignment pass if needed.
        """
        if not self.ai_manager:
            logger.info(f"[{self.thero_name}] AI not enabled, skipping alignment.")
            return
        elif not self.ai_config.get("chapters"):
            logger.info(
                f"[{self.thero_name}] Chapters not enabled, skipping alignment."
            )
            return

        logger.info(f"[{self.thero_name}] Starting chapter alignment pass...")
        metadata_keys = self.s3.list_metadata_files()

        for key in metadata_keys:
            # Check rate limits (reuse AI periodic limit logic primarily)
            if not self.rate_limiter.can_ai_call_periodic()[0]:
                logger.info(
                    f"[{self.thero_name}] AI rate limit hit, pausing alignment."
                )
                break

            metadata = self.s3.get_json(key)
            if not metadata:
                continue

            video_id = metadata.get("id")
            ai_resp = metadata.get("ai_response")

            if (
                ai_resp
                and ai_resp.get("chapters")
                and not ai_resp.get("aligned_chapters")
            ):
                logger.info(f"[{self.thero_name}] Aligning chapters for {video_id}...")

                transcript_path = None
                try:
                    logger.info(
                        f"[{self.thero_name}] Fetching transcript for {metadata['id']}..."
                    )
                    transcript_text = get_transcript_text(metadata["original_url"])

                    if transcript_text:
                        transcript_path = f"{metadata['id']}_transcript.txt"
                        with open(transcript_path, "w", encoding="utf-8") as f:
                            f.write(transcript_text)

                        logger.info(
                            f"[{self.thero_name}] Uploading transcript to S3: {metadata['id']}"
                        )
                        self.s3.upload_file(
                            transcript_path,
                            f"transcripts/{metadata['id']}.txt",
                            "text/plain",
                        )
                except Exception as e:
                    logger.warning(
                        f"[{self.thero_name}] Warning: Failed to fetch/upload transcript: {e}"
                    )
                    continue

                if transcript_path:
                    aligned_chapters = None
                    try:
                        aligned_chapters = self.ai_manager.align_chapters(
                            video_id, ai_resp["chapters"], transcript_path
                        )
                    except Exception as e:
                        logger.warning(
                            f"[{self.thero_name}] Warning: Failed to align chapters for {video_id}: {e}"
                        )
                    finally:
                        self.rate_limiter.record_ai_call()

                    if aligned_chapters:
                        ai_resp["aligned_chapters"] = aligned_chapters
                        metadata["ai_response"] = ai_resp

                        self.ai_manager.cache_response(video_id, ai_resp)
                        self.s3.save_metadata(metadata)

                        # Re-format chapters for chapters.json (00:00 start, etc)
                        formatted = self._get_formatted_chapters(ai_resp)
                        if formatted:
                            # Upload chapters.json
                            chapters_file = f"{video_id}_chapters.json"
                            with open(chapters_file, "w", encoding="utf-8") as f:
                                json.dump(formatted, f, indent=2, ensure_ascii=False)
                            self.s3.upload_file(
                                chapters_file, chapters_file, "application/json"
                            )
                            if os.path.exists(chapters_file):
                                os.remove(chapters_file)

                        logger.info(
                            f"[{self.thero_name}] Chapter alignment complete for {video_id}."
                        )
                    else:
                        logger.warning(
                            f"[{self.thero_name}] Alignment returned None for {video_id}."
                        )


def run_sync_workflow():
    theros_dir = os.path.join(os.path.dirname(__file__), "theros")
    for filename in os.listdir(theros_dir):
        if filename.endswith(".json") and "_thero" in filename:
            try:
                config = load_thero_data(os.path.join(theros_dir, filename))
                if not config.get("enabled", True):
                    logger.info(f"Skipping {filename}: Disabled in config.")
                    continue
                PodcastSync(config).sync()
            except Exception as e:
                logger.error(f"Error syncing {filename}: {e}", exc_info=True)
                with sentry_sdk.new_scope() as scope:
                    scope.set_tag("thero_config", filename)
                    sentry_sdk.capture_exception(e)


def run_rss_update_workflow():
    theros_dir = os.path.join(os.path.dirname(__file__), "theros")
    for filename in os.listdir(theros_dir):
        if filename.endswith(".json") and "_thero" in filename:
            try:
                config = load_thero_data(os.path.join(theros_dir, filename))
                if not config.get("enabled", True):
                    logger.info(f"Skipping {filename}: Disabled in config.")
                    continue
                PodcastSync(config).refresh_rss()
            except Exception as e:
                logger.error(f"Error refreshing RSS for {filename}: {e}", exc_info=True)
                with sentry_sdk.new_scope() as scope:
                    scope.set_tag("thero_config", filename)
                    sentry_sdk.capture_exception(e)


def run_chapter_alignment_workflow():
    theros_dir = os.path.join(os.path.dirname(__file__), "theros")
    for filename in os.listdir(theros_dir):
        if filename.endswith(".json") and "_thero" in filename:
            try:
                config = load_thero_data(os.path.join(theros_dir, filename))
                if not config.get("enabled", True):
                    continue
                PodcastSync(config).align_all_chapters()
            except Exception as e:
                logger.error(
                    f"Error in alignment workflow for {filename}: {e}", exc_info=True
                )


if __name__ == "__main__":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )
    setup_logging()
    # run_sync_workflow()
    run_rss_update_workflow()
    # run_chapter_alignment_workflow()
