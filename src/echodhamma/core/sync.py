import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor

import sentry_sdk
from dotenv import load_dotenv

from echodhamma.services.ai_manager import (
    AIManager,
)
from echodhamma.services.audio_processor import AudioProcessor
from echodhamma.utils.logger import setup_logging
from echodhamma.core.metrics import (
    filtered_items_counter,
    sync_run_counter,
    success_counter,
    failure_counter,
    skipped_counter,
)
from echodhamma.services.notifier import Notifier
from echodhamma.core.rate_limiter import RateLimiter
from echodhamma.services.rss_generator import RSSGenerator
from echodhamma.services.s3_manager import S3Manager
from echodhamma.services.transcript_service import (
    get_transcript_text,
    TranscriptsDisabledError,
)


from echodhamma.services.youtube_client import YouTubeClient
from echodhamma.services.video_processor import VideoProcessor
from echodhamma.services.feed_composer import FeedComposer
from echodhamma.core.workflow_runner import WorkflowRunner

logger = logging.getLogger(__name__)
load_dotenv()

DEFAULT_MAX_VIDEOS_PER_DAY = 999
DEFAULT_MAX_AI_CALLS_PER_DAY = 10


class PodcastSync:
    def __init__(self, thero_config):
        self.config = thero_config
        self.thero_id = thero_config["id"]
        self.blocklist = set(thero_config.get("blocklist", []))
        self.thero_name = thero_config.get("name", self.thero_id)
        self.podcast_config = thero_config["podcast"]
        self.ai_config = thero_config.get("ai_config", {"enabled": False})
        self.whitelist_config = thero_config.get("whitelist", [])
        self.sync_config = thero_config.get(
            "sync_config", {"max_videos_per_day": DEFAULT_MAX_VIDEOS_PER_DAY}
        )

        s3_conf = thero_config["s3"]
        self.s3 = S3Manager(
            endpoint=os.getenv(s3_conf["endpoint_env"]),
            bucket=os.getenv(s3_conf["bucket_env"]),
            access_key=os.getenv(s3_conf["access_key_env"]),
            secret_key=os.getenv(s3_conf["secret_key_env"]),
        )
        self.base_url = f"{self.s3.endpoint}/{self.s3.bucket}"

        self.audio = AudioProcessor(self.thero_name)
        self.ai_manager = AIManager(self.s3) if self.ai_config.get("enabled") else None
        self.yt_client = YouTubeClient()

        self.video_processor = VideoProcessor(
            self.yt_client, self.s3, self.audio, self.ai_manager, self.config
        )
        self.feed_composer = FeedComposer(self.config)

        self.state_file = "sync_state.json"
        self.rate_limiter = RateLimiter(
            self.s3,
            self.state_file,
            self.sync_config.get("max_videos_per_day", DEFAULT_MAX_VIDEOS_PER_DAY),
            self.sync_config.get("max_ai_calls_per_day", DEFAULT_MAX_AI_CALLS_PER_DAY),
        )

    def _is_sync_allowed(self) -> bool:
        if not self.rate_limiter.can_sync_daily():
            logger.info(
                f"[{self.thero_name}] Daily sync limit reached ({self.rate_limiter.max_per_day}). Stopping sync."
            )
            return False

        can_sync, wait_min = self.rate_limiter.can_sync_periodic()
        if not can_sync:
            logger.info(
                f"[{self.thero_name}] Sync limited; waiting {wait_min} minutes before next attempt."
            )
            return False

        if self.ai_manager:
            if not self.rate_limiter.can_ai_call_daily():
                logger.info(
                    f"[{self.thero_name}] Daily AI call limit reached ({self.rate_limiter.max_ai_calls_per_day}). Stopping sync."
                )
                return False

            can_ai_call, ai_wait_min = self.rate_limiter.can_ai_call_periodic()
            if not can_ai_call:
                logger.info(
                    f"[{self.thero_name}] AI rate limited; waiting {ai_wait_min} minutes before next attempt."
                )
                return False

        return True

    def _is_valid_episode(self, metadata):
        ai_resp = metadata.get("ai_response") or {}
        is_friendly = ai_resp.get("podcast_friendly", True)
        is_match = metadata.get("title_match", True)

        is_chapters_ready = not ai_resp.get("chapters") or bool(
            ai_resp.get("aligned_chapters")
        )

        is_in_block_list = metadata.get("id") in self.blocklist

        return (
            is_friendly is not False
            and is_match is not False
            and is_chapters_ready is not False
            and is_in_block_list is not True
        )

    def _get_expanded_whitelist(self):
        whitelisted_ids = set()
        for item in self.whitelist_config:
            # Simple heuristic: Video IDs are 11 chars. Playlists are usually much longer (24-34+ chars)
            if len(item) > 12:
                logger.info(f"[{self.thero_name}] Expanding whitelist playlist: {item}")
                ids = self.yt_client.index_playlist(item)
                whitelisted_ids.update(ids)
            else:
                whitelisted_ids.add(item)
        return whitelisted_ids

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

        video_items = self.yt_client.get_channel_videos(urls)
        video_items.sort(key=lambda x: x.get("upload_date") or "99999999")

        whitelisted_ids = self._get_expanded_whitelist()

        for item in video_items:
            if not self._is_sync_allowed():
                break

            vid_id = item["id"]
            if self.s3.file_exists(f"{vid_id}.json"):
                continue

            try:
                is_whitelisted = vid_id in whitelisted_ids
                metadata = self.video_processor.process(
                    item["url"], is_whitelisted=is_whitelisted
                )

                # Save metadata regardless of outcome to avoid re-processing
                self.s3.save_metadata(metadata)

                if metadata.get("title_match") is False:
                    skipped_counter.labels(
                        thero=self.thero_id, reason="title_mismatch"
                    ).inc()
                elif (
                    metadata.get("ai_response")
                    and metadata["ai_response"].get("podcast_friendly") is False
                ):
                    skipped_counter.labels(
                        thero=self.thero_id, reason="not_podcast_friendly"
                    ).inc()
                else:
                    self.rate_limiter.record_success()
                    success_counter.labels(thero=self.thero_id).inc()

            except Exception as e:
                logger.error(
                    f"[{self.thero_name}] Error during processing for {vid_id}: {e}",
                    exc_info=True,
                )
                with sentry_sdk.new_scope() as scope:
                    scope.set_tag("video_id", vid_id)
                    scope.set_tag("thero_id", self.thero_id)
                    sentry_sdk.capture_exception(e)

                failure_counter.labels(thero=self.thero_id).inc()

        logger.info(f"[{self.thero_name}] Sync complete.")

    def refresh_rss(self):
        logger.info(f"[{self.thero_name}] Refreshing RSS feed...")

        video_series_map = {}
        known_series = self.config.get("known_series", [])

        def find_playlists_recursive(series_list, parent_path=[]):
            for series in series_list:
                current_path = parent_path + [series["name"]]
                playlist_ids = series.get("playlist_ids", [])
                if playlist_ids:
                    for pl_id in playlist_ids:
                        vids = self.yt_client.index_playlist(pl_id)
                        for vid in vids:
                            video_series_map[vid] = current_path
                find_playlists_recursive(series.get("sub_series", []), current_path)

        find_playlists_recursive(known_series)
        logger.info(
            f"[{self.thero_name}] Indexed {len(video_series_map)} videos from playlists."
        )

        metadata_keys = self.s3.list_metadata_files()
        logger.info(
            f"[{self.thero_name}] Found {len(metadata_keys)} metadata files in S3."
        )

        def process_metadata_item(key):
            res = self.s3.get_json(key)
            if res and self._is_valid_episode(res):
                return self.feed_composer.prepare_feed_item(res, video_series_map)
            return None

        with ThreadPoolExecutor(max_workers=self.s3.max_concurrency) as executor:
            items = [
                res
                for res in executor.map(process_metadata_item, metadata_keys)
                if res is not None
            ]

        items = self.feed_composer.filter_and_sort_items(items)

        original_count = len(metadata_keys)
        if len(items) < original_count:
            count = original_count - len(items)
            filtered_items_counter.labels(thero=self.thero_id).inc(count)

        rss_file = self.config.get("rss_filename", "podcast.xml")
        RSSGenerator.generate(self.config, items, self.base_url, rss_file)
        self.s3.upload_file(rss_file, rss_file, "application/xml")
        if os.path.exists(rss_file):
            os.remove(rss_file)

        rss_url = f"{self.base_url}/{rss_file}"
        try:
            Notifier.notify_all(rss_url)
        except Exception as e:
            logger.warning(f"[{self.thero_name}] Notification failed: {e}")

        logger.info(f"[{self.thero_name}] RSS refresh complete.")

    def align_all_chapters(self):
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
                self._perform_alignment(metadata, ai_resp)

    def _perform_alignment(self, metadata, ai_resp):
        transcript_path = None
        video_id = metadata["id"]
        try:
            try:
                transcript_text = get_transcript_text(metadata["original_url"])

                if transcript_text:
                    transcript_path = f"{video_id}_transcript.txt"
                    with open(transcript_path, "w", encoding="utf-8") as f:
                        f.write(transcript_text)

                    self.s3.upload_file(
                        transcript_path,
                        f"transcripts/{video_id}.txt",
                        "text/plain",
                    )
            except TranscriptsDisabledError:
                logger.warning(
                    f"[{self.thero_name}] Subtitles disabled for {video_id}. Creating missing marker."
                )
                missing_file = f"{video_id}_transcript.missing"
                with open(missing_file, "w", encoding="utf-8") as f:
                    f.write(video_id)
                try:
                    self.s3.upload_file(missing_file, missing_file, "text/plain")
                finally:
                    if os.path.exists(missing_file):
                        os.remove(missing_file)
                return
            except Exception as e:
                logger.warning(
                    f"[{self.thero_name}] Warning: Failed to fetch/upload transcript: {e}"
                )
                return

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

                    formatted = self.feed_composer.format_chapters(ai_resp)
                    if formatted:
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
        finally:
            if transcript_path and os.path.exists(transcript_path):
                os.remove(transcript_path)


def run_sync_workflow():
    WorkflowRunner.run_for_all_theros(lambda config: PodcastSync(config).sync(), "Sync")


def run_rss_update_workflow():
    WorkflowRunner.run_for_all_theros(
        lambda config: PodcastSync(config).refresh_rss(), "RSS Refresh"
    )


def run_chapter_alignment_workflow():
    WorkflowRunner.run_for_all_theros(
        lambda config: PodcastSync(config).align_all_chapters(), "Chapter Alignment"
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
