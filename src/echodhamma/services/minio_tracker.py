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
        umami_base = os.getenv("UMAMI_URL", "https://your-umami-instance.com")
        if umami_base.endswith("/api/send"):
            self.umami_url = umami_base
        else:
            self.umami_url = f"{umami_base.rstrip('/')}/api/send"
        self.dedupe_window = int(os.getenv("DEDUPE_WINDOW", 10800))  # 3 hour in seconds
        self.download_cache = {}
        self.hostname = os.getenv("TRACKING_HOSTNAME", "no.op")
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
                    thero_id = data.get("id")

                    bucket_env = s3_config.get("bucket_env")
                    website_id = umami_config.get("website_id")

                    if bucket_env and website_id and thero_id:
                        bucket_name = os.getenv(bucket_env)
                        if bucket_name:
                            mapping[bucket_name] = {
                                "website_id": website_id,
                                "thero_id": thero_id,
                                "thero_name": data.get("name"),
                                "thero_name_sinhala": data.get("name_sinhala"),
                            }
                        else:
                            logger.warning(
                                f"Bucket env var {bucket_env} not set for {file_path}"
                            )

                except Exception as e:
                    logger.error(f"Error loading thero config {file_path}: {e}")

        except Exception as e:
            logger.error(f"Error initializing bucket map: {e}")

        return mapping

    def _parse_user_agent(self, ua_string):
        """Parses a User-Agent string to identify common podcast clients, OS, and device types."""
        if not ua_string or not isinstance(ua_string, str):
            return {
                "podcast_client": "Unknown Client",
                "podcast_os": "Unknown OS",
                "podcast_device": "Unknown Device",
            }

        ua_lower = ua_string.lower()

        # 1. Identify Podcast Client
        client = "Other Podcast Client"
        if "spotify" in ua_lower:
            client = "Spotify"
        elif "pocketcasts" in ua_lower or "pocket casts" in ua_lower:
            client = "Pocket Casts"
        elif "antennapod" in ua_lower:
            client = "AntennaPod"
        elif "overcast" in ua_lower:
            client = "Overcast"
        elif "castbox" in ua_lower:
            client = "Castbox"
        elif "podcastaddict" in ua_lower or "podcast addict" in ua_lower:
            client = "Podcast Addict"
        elif "googlepodcasts" in ua_lower or "google podcasts" in ua_lower:
            client = "Google Podcasts"
        elif "amazonmusic" in ua_lower or "amazon music" in ua_lower:
            client = "Amazon Music"
        elif "deezer" in ua_lower:
            client = "Deezer"
        elif (
            "itunes" in ua_lower
            or "applecoremedia" in ua_lower
            or "podcast" in ua_lower
            or "podcasts" in ua_lower
        ):
            client = "Apple Podcasts"
        elif (
            "chrome" in ua_lower
            or "safari" in ua_lower
            or "firefox" in ua_lower
            or "edge" in ua_lower
        ):
            client = "Web Browser"

        # 2. Identify OS
        os_name = "Unknown OS"
        if (
            "iphone" in ua_lower
            or "ipad" in ua_lower
            or "ipod" in ua_lower
            or "ios" in ua_lower
        ):
            os_name = "iOS"
        elif "android" in ua_lower:
            os_name = "Android"
        elif (
            "macintosh" in ua_lower
            or "mac os x" in ua_lower
            or "mac_powerpc" in ua_lower
        ):
            os_name = "macOS"
        elif (
            "windows" in ua_lower
            or "win32" in ua_lower
            or "win64" in ua_lower
        ):
            os_name = "Windows"
        elif "linux" in ua_lower:
            os_name = "Linux"

        # 3. Identify Device Type
        device = "Unknown Device"
        if "iphone" in ua_lower or "ipod" in ua_lower or "android" in ua_lower:
            device = "Mobile"
        elif "ipad" in ua_lower or "tablet" in ua_lower:
            device = "Tablet"
        elif (
            "macintosh" in ua_lower
            or "windows" in ua_lower
            or "linux" in ua_lower
        ):
            device = "Desktop"
        elif (
            "sonos" in ua_lower
            or "alexa" in ua_lower
            or "homepod" in ua_lower
            or "echo" in ua_lower
        ):
            device = "Smart Speaker"

        return {
            "podcast_client": client,
            "podcast_os": os_name,
            "podcast_device": device,
        }

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
            if not (200 <= response.status_code < 300):
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
        logger.info("Received MinIO event webhook request.")
        logger.debug(f"Raw MinIO event payload: {data}")

        if not data or "Records" not in data:
            logger.warning("MinIO event payload has no 'Records' key or is empty.")
            return {"status": "ignored"}

        processed_count = 0

        for record in data["Records"]:
            # Safety check for expected structure
            if "s3" not in record or "object" not in record["s3"]:
                logger.debug(f"Skipping record due to missing s3 or object metadata: {record}")
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
            # Extract visitor User-Agent from source
            source_info = record.get("source", {})
            user_agent = source_info.get("userAgent")
            
            # Skip events triggered by scripts/tools (boto3, botocore, minio clients, rclone, curl, etc.)
            if user_agent and isinstance(user_agent, str):
                ua_lower = user_agent.lower()
                if any(ignored in ua_lower for ignored in ["boto3", "botocore", "minio", "rclone", "curl", "wget", "http.client"]):
                    continue

            logger.info(
                f"MinIO event details: bucket={bucket_name}, file_key={file_key}, "
                f"client_ip={client_ip}, user_agent={user_agent}"
            )

            if not user_agent or not isinstance(user_agent, str):
                user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0"

            # 1. Only track MP3s
            if not file_key.endswith(".mp3"):
                logger.debug(f"Skipping non-MP3 file download event: {file_key}")
                continue

            # 2. DEDUPLICATION LOGIC
            if self.is_duplicate(client_ip, file_key):
                logger.info(f"Deduplicated event: file_key={file_key} from client_ip={client_ip}")
                continue

            if bucket_name not in self.bucket_map:
                logger.warning(
                    f"Ignored event from unknown or unmapped bucket: {bucket_name}. "
                    f"Mapped buckets: {list(self.bucket_map.keys())}"
                )
                continue

            bucket_info = self.bucket_map[bucket_name]
            website_id = bucket_info["website_id"]
            thero_id = bucket_info["thero_id"]
            thero_name = (
                bucket_info.get("thero_name_sinhala")
                or bucket_info.get("thero_name")
                or bucket_name
            )

            # Generate URL path and title mimicking the website details page
            episode_filename = os.path.basename(file_key)
            episode_id = os.path.splitext(episode_filename)[0]
            url_path = f"/podcast/{thero_id}/{episode_id}"
            page_title = f"{thero_name} - {episode_id}"

            # Parse user agent details
            ua_details = self._parse_user_agent(user_agent)

            # 3. Send to Umami (Pageview event payload - omitting name)
            payload = {
                "type": "event",
                "payload": {
                    "website": website_id,
                    "url": url_path,
                    "hostname": self.hostname,
                    "language": "en-US",
                    "screen": "1920x1080",
                    "title": page_title,
                    "data": {
                        "podcast_client": ua_details["podcast_client"],
                        "podcast_os": ua_details["podcast_os"],
                        "podcast_device": ua_details["podcast_device"],
                        "file_name": file_key,
                        "bucket": bucket_name,
                    },
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
