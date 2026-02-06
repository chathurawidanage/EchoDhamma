import logging
import os
import requests
from echodhamma.utils.date_utils import get_pub_date
from echodhamma.utils.title_matcher import is_thero_in_content

logger = logging.getLogger(__name__)
HTTP_REQUEST_TIMEOUT = 60


class VideoProcessor:
    def __init__(
        self, youtube_client, s3_manager, audio_processor, ai_manager=None, config=None
    ):
        self.yt_client = youtube_client
        self.s3 = s3_manager
        self.audio = audio_processor
        self.ai_manager = ai_manager
        self.config = config or {}
        self.thero_name = config.get("name", "Unknown")
        self.thero_id = config.get("id", "unknown")
        self.base_url = f"{self.s3.endpoint}/{self.s3.bucket}"

    def process(self, video_url, is_whitelisted=False):
        raw_file = None
        mp3_file = None
        img_file = None

        try:
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

            info = self.yt_client.get_video_info(video_url)

            metadata["id"] = info["id"]
            metadata["title"] = info.get("title", "No Title")
            metadata["original_url"] = video_url
            metadata["pub_date"] = get_pub_date(info)
            metadata["duration"] = info.get("duration", 0)
            metadata["whitelisted"] = is_whitelisted

            yt_description = info.get("description", "")
            if (
                not is_whitelisted
                and "matcher" in self.config
                and not is_thero_in_content(
                    metadata["title"], yt_description, self.config
                )
            ):
                logger.info(
                    f"[{self.thero_name}] Skipping {metadata['id']}: Title mismatch."
                )
                metadata["title_match"] = False
                return metadata

            if self.ai_manager:
                metadata["ai_response"] = self._generate_ai_metadata(
                    metadata["id"], video_url
                )

            is_podcast_friendly = True
            if (
                metadata["ai_response"]
                and metadata["ai_response"].get("podcast_friendly") is False
            ):
                is_podcast_friendly = False
                logger.info(
                    f"[{self.thero_name}] Video {metadata['id']} is not podcast-friendly. Skipping audio processing."
                )
                return metadata

            if is_podcast_friendly:
                logger.info(f"[{self.thero_name}] Downloading audio: {metadata['id']}")
                raw_file = self.yt_client.download_audio(
                    video_url, f"{metadata['id']}_raw.%(ext)s"
                )

                mp3_file = f"{metadata['id']}.mp3"
                img_file = f"{metadata['id']}.jpg"

                logger.info(f"[{self.thero_name}] Processing audio: {metadata['id']}")
                self.audio.convert_to_mp3(raw_file, mp3_file)

                logger.info(f"[{self.thero_name}] Uploading MP3: {metadata['id']}")
                self.s3.upload_file(mp3_file, mp3_file, "audio/mpeg")
                metadata["s3_audio_url"] = f"{self.base_url}/{mp3_file}"
                metadata["length_bytes"] = os.path.getsize(mp3_file)

                thumb_url = info.get("thumbnail")
                if thumb_url:
                    self._upload_thumbnail(thumb_url, img_file)
                    metadata["s3_image_url"] = f"{self.base_url}/{img_file}"

            return metadata

        finally:
            for f in [raw_file, mp3_file, img_file]:
                if f and os.path.exists(f):
                    os.remove(f)

    def _generate_ai_metadata(self, video_id, video_url):
        cached = self.ai_manager.get_cached_response(video_id)
        if cached:
            logger.info(f"[{self.thero_name}] Using cached AI metadata for {video_id}.")
            return cached

        logger.info(f"[{self.thero_name}] Generating AI metadata for {video_id}...")
        response = self.ai_manager.generate_metadata(video_url)

        if response:
            self.ai_manager.cache_response(video_id, response)
            return response
        return None

    def _upload_thumbnail(self, thumb_url, img_file):
        try:
            with requests.get(
                thumb_url, stream=True, timeout=HTTP_REQUEST_TIMEOUT
            ) as r:
                if r.status_code == 200:
                    with open(img_file, "wb") as f:
                        for chunk in r.iter_content(1024):
                            f.write(chunk)
                    self.s3.upload_file(img_file, img_file, "image/jpeg")
        except Exception as e:
            logger.error(f"[{self.thero_name}] Thumbnail error: {e}")
