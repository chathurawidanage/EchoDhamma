import os
import time
import requests
import logging
import sentry_sdk
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class MinioTracker:
    def __init__(self):
        self.umami_url = os.getenv(
            "UMAMI_URL", "https://your-umami-instance.com/api/send"
        )
        self.umami_website_id = os.getenv("UMAMI_WEBSITE_ID", "your-website-uuid")
        self.dedupe_window = int(os.getenv("DEDUPE_WINDOW", 3600))  # 1 hour in seconds
        self.download_cache = {}
        # Separate executor for lightweight tracking tasks
        self.executor = ThreadPoolExecutor(max_workers=4)

    def is_duplicate(self, ip, file_key):
        """Check if this IP has downloaded this file recently."""
        current_time = time.time()
        cache_key = (ip, file_key)

        if cache_key in self.download_cache:
            last_seen = self.download_cache[cache_key]
            if current_time - last_seen < self.dedupe_window:
                return True

        # Update cache with new timestamp
        self.download_cache[cache_key] = current_time

        # Optional: Clean up cache occasionally to prevent memory bloat
        if len(self.download_cache) > 5000:
            self.clean_cache(current_time)

        return False

    def clean_cache(self, now):
        """Remove expired entries from cache."""
        self.download_cache = {
            k: v for k, v in self.download_cache.items() if now - v < self.dedupe_window
        }

    def _log_download_async(self, payload, headers, file_key):
        """Helper to send Umami request in background."""
        try:
            requests.post(self.umami_url, json=payload, headers=headers, timeout=5)
            logger.info(f"✅ Unique Download Logged: {file_key}")
        except Exception as e:
            logger.error(f"❌ Umami Error: {e}")
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("task", "minio_event_hook")
                sentry_sdk.capture_exception(e)

    def process_event(self, data):
        """Process Minio event data."""
        if not data or "Records" not in data:
            return {"status": "ignored"}

        processed_count = 0

        for record in data["Records"]:
            # Safety check for expected structure
            if "s3" not in record or "object" not in record["s3"]:
                continue

            # Extract basic info
            s3_info = record["s3"]
            file_key = s3_info["object"]["key"]

            # Handle bucket name safely
            bucket_name = "unknown"
            if "bucket" in s3_info and "name" in s3_info["bucket"]:
                bucket_name = s3_info["bucket"]["name"]

            # Get request parameters safely
            request_params = record.get("requestParameters", {})
            client_ip = request_params.get("sourceIPAddress", "0.0.0.0")
            user_agent = request_params.get("userAgent", "Unknown")

            # 1. Only track MP3s
            if not file_key.endswith(".mp3"):
                continue

            # 2. DEDUPLICATION LOGIC
            if self.is_duplicate(client_ip, file_key):
                logger.info(
                    f"Skipping duplicate chunk/request: {file_key} from {client_ip}"
                )
                continue

            # 3. Send to Umami
            payload = {
                "type": "event",
                "payload": {
                    "website": self.umami_website_id,
                    "url": f"/podcast/{file_key}",
                    "event_name": "Podcast Download",
                    "event_data": {"file_name": file_key, "bucket": bucket_name},
                    "hostname": "minio.local",
                },
            }

            headers = {
                "User-Agent": user_agent,
                "X-Forwarded-For": client_ip,
                "Content-Type": "application/json",
            }

            try:
                self.executor.submit(
                    self._log_download_async, payload, headers, file_key
                )
                processed_count += 1
            except Exception as e:
                logger.error(f"Error submitting tracking task: {e}")

        return {"status": "success", "processed": processed_count}
