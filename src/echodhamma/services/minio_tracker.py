import os
import time
import requests
import logging
import sentry_sdk
import glob
from concurrent.futures import ThreadPoolExecutor

from echodhamma.utils.title_matcher import load_thero_data

logger = logging.getLogger(__name__)


class MinioTracker:
    def __init__(self):
        self.umami_url = os.getenv(
            "UMAMI_URL", "https://your-umami-instance.com/api/send"
        )
        self.dedupe_window = int(os.getenv("DEDUPE_WINDOW", 10800))  # 3 hour in seconds
        self.download_cache = {}
        # Separate executor for lightweight tracking tasks
        self.executor = ThreadPoolExecutor(max_workers=4)

        # Load bucket -> website_id mapping
        self.bucket_map = self._load_bucket_map()

    def _load_bucket_map(self):
        """Loads thero configs to map bucket names to Umami website IDs."""
        mapping = {}
        try:
            theros_dir = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "theros"
            )
            config_files = glob.glob(os.path.join(theros_dir, "*_thero.json"))

            for file_path in config_files:
                try:
                    data = load_thero_data(file_path)

                    # Check if enabled and has necessary config
                    if not data.get("enabled", True):
                        continue

                    s3_config = data.get("s3", {})
                    umami_config = data.get("umami", {})

                    bucket_env = s3_config.get("bucket_env")
                    website_id = umami_config.get("website_id")

                    if bucket_env and website_id:
                        bucket_name = os.getenv(bucket_env)
                        if bucket_name:
                            mapping[bucket_name] = website_id
                            logger.info(
                                f"Loaded Umami mapping: {bucket_name} -> {website_id}"
                            )
                        else:
                            logger.warning(
                                f"Bucket env var {bucket_env} not set for {file_path}"
                            )

                except Exception as e:
                    logger.error(f"Error loading thero config {file_path}: {e}")

        except Exception as e:
            logger.error(f"Error initializing bucket map: {e}")

        return mapping

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
            response = requests.post(
                self.umami_url, json=payload, headers=headers, timeout=5
            )
            if response.status_code >= 200 and response.status_code < 300:
                logger.info(
                    f"✅ Unique Download Logged: {file_key} (Status: {response.status_code})"
                )
            else:
                logger.error(
                    f"❌ Umami Failed: {response.status_code} - {response.text}"
                )
        except Exception as e:
            logger.error(f"❌ Umami Exception: {e}")
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

            if bucket_name not in self.bucket_map:
                logger.warning(
                    f"Ignored event from unknown or unmapped bucket: {bucket_name}"
                )
                continue

            website_id = self.bucket_map[bucket_name]

            # 3. Send to Umami
            payload = {
                "type": "event",
                "payload": {
                    "website": website_id,
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
