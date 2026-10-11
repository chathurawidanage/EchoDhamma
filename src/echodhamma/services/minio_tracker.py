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
        self.umami_website_id = os.getenv("LISTENS_TRACKER_UMAMI_WEBSITE_ID")
        if not self.umami_website_id:
            raise ValueError(
                "LISTENS_TRACKER_UMAMI_WEBSITE_ID environment variable is required but not set"
            )
        self.dedupe_window = int(
            os.getenv("DEDUPE_WINDOW", 86400)
        )  # 24 hours in seconds (IAB standard)
        self.download_cache = {}
        self.hostname = os.getenv("TRACKING_HOSTNAME", "no.op")
        # Separate executor for lightweight tracking tasks
        self.executor = ThreadPoolExecutor(max_workers=4)

        # Load bucket -> thero mapping
        self.bucket_map = self._load_bucket_map()

    def _load_bucket_map(self):
        """Loads thero configs to map bucket names to thero details."""
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
                    thero_id = data.get("id")

                    bucket_env = s3_config.get("bucket_env")

                    if bucket_env and thero_id:
                        bucket_name = os.getenv(bucket_env)
                        if bucket_name:
                            mapping[bucket_name] = {
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
        elif (
            "googlepodcasts" in ua_lower
            or "google podcasts" in ua_lower
            or "google-podcast" in ua_lower
        ):
            client = "Google Podcasts"
        elif "amazonmusic" in ua_lower or "amazon music" in ua_lower:
            client = "Amazon Music"
        elif "deezer" in ua_lower:
            client = "Deezer"
        elif "ivoox" in ua_lower:
            client = "iVoox"
        elif "wordpress" in ua_lower:
            client = "WordPress Player"
        elif (
            "itunes" in ua_lower
            or "itms" in ua_lower
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
            or "itms" in ua_lower
            or "applecoremedia" in ua_lower
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
        elif "windows" in ua_lower or "win32" in ua_lower or "win64" in ua_lower:
            os_name = "Windows"
        elif "linux" in ua_lower:
            os_name = "Linux"

        # 3. Identify Device Type
        device = "Unknown Device"
        if (
            "iphone" in ua_lower
            or "ipod" in ua_lower
            or "android" in ua_lower
            or "itms" in ua_lower
            or "applecoremedia" in ua_lower
        ):
            device = "Mobile"
        elif "ipad" in ua_lower or "tablet" in ua_lower:
            device = "Tablet"
        elif "macintosh" in ua_lower or "windows" in ua_lower or "linux" in ua_lower:
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

    def _is_crawler(self, user_agent):
        """Identifies known indexing crawlers, bots, or aggregators that should be excluded from download metrics."""
        if not user_agent:
            return False
        ua_lower = user_agent.lower()
        crawler_keywords = [
            "bot",
            "crawler",
            "spider",
            "index",
            "feed",
            "parser",
            "scanner",
            "aggregator",
            "aggrivator",
            "rephonic",
            "piqo",
            "fetcher",
            "guzzlehttp",
            "axios",
        ]
        # Allow Pocket Casts and Amazon Music players (which can contain 'feed' or 'podcast')
        # while blocking their crawler counterparts (e.g. Feed Parser/Scanner)
        if (
            "pocketcasts" in ua_lower
            or "amazonmusic" in ua_lower
            or "spotify" in ua_lower
            or "ivoox" in ua_lower
        ):
            if "parser" in ua_lower or "scanner" in ua_lower or "bot" in ua_lower:
                return True
            return False

        return any(keyword in ua_lower for keyword in crawler_keywords)

    def _parse_range_header(self, range_header):
        """
        Parses an HTTP Range header (e.g. 'bytes=0-1802166' or 'bytes=0-').
        Returns (start_byte, end_byte, length) or (None, None, None).
        """
        if not range_header or not isinstance(range_header, str):
            return None, None, None
        if not range_header.startswith("bytes="):
            return None, None, None
        try:
            spec = range_header.replace("bytes=", "").strip()
            parts = spec.split("-")
            if len(parts) == 2:
                start_str, end_str = parts[0].strip(), parts[1].strip()
                start = int(start_str) if start_str.isdigit() else None
                end = int(end_str) if end_str.isdigit() else None
                length = (
                    (end - start + 1)
                    if (start is not None and end is not None)
                    else None
                )
                return start, end, length
        except Exception:
            pass
        return None, None, None

    def evaluate_session_action(
        self,
        ip,
        user_agent="Unknown",
        file_key=None,
        range_header=None,
        content_length=None,
    ):
        """
        Evaluates the session state for this IP, User-Agent, and file download.
        Adheres to IAB Podcast Measurement Guidelines v2.1:
        - Bounded initial range requests (e.g. Safari pre-buffering 1.8 MB) are
          marked as pending and NOT immediately counted as plays.
        - Play confirmation occurs when subsequent chunks are requested or
          playback progresses past the initial buffer.
        - Full downloads (unbounded or >= 5 MB at once) are confirmed immediately.
        - Active streams receive heartbeats every 60s to extend visit duration.
        - Deduplication window default is 24 hours (86400s).

        Returns:
            "play" - confirmed active play or full episode download.
            "heartbeat" - active streaming session progression (>= 60s since last heartbeat).
            "skip" - initial pre-buffer chunk, duplicate request, or throttled range request.
        """
        # Support backward compatibility if called as evaluate_session_action(ip, file_key)
        if file_key is None:
            file_key = user_agent
            user_agent = "Unknown"

        current_time = time.time()
        ua_key = (user_agent or "unknown").strip().lower()[:100]
        cache_key = (ip, ua_key, file_key)

        start_byte, end_byte, range_bytes = self._parse_range_header(range_header)

        # Detect full file downloads vs bounded partial range pre-buffers
        is_full_or_large_request = False
        if range_header is None:
            # Full file requested without Range header
            is_full_or_large_request = True
        elif start_byte == 0 and end_byte is None:
            # Open-ended range request (bytes=0-) downloading entire stream/file
            is_full_or_large_request = True
        elif range_bytes is not None and range_bytes >= 5 * 1024 * 1024:
            # Single range request downloading >= 5 MB
            is_full_or_large_request = True
        elif content_length is not None and content_length >= 5 * 1024 * 1024:
            is_full_or_large_request = True

        session = self.download_cache.get(cache_key)

        # 1. New Session
        if session is None:
            if is_full_or_large_request:
                # Full file download (e.g. podcast app offline sync)
                self.download_cache[cache_key] = {
                    "start_time": current_time,
                    "last_heartbeat_time": current_time,
                    "last_activity_time": current_time,
                    "confirmed": True,
                    "chunks_count": 1,
                }
                if len(self.download_cache) > 5000:
                    self.clean_cache(current_time)
                return "play"
            else:
                # Initial bounded pre-buffer chunk (e.g. Safari bytes=0-1802166)
                # Hold in pending state without logging to Umami
                self.download_cache[cache_key] = {
                    "start_time": current_time,
                    "last_heartbeat_time": current_time,
                    "last_activity_time": current_time,
                    "confirmed": False,
                    "chunks_count": 1,
                    "first_range_end": end_byte or 0,
                }
                if len(self.download_cache) > 5000:
                    self.clean_cache(current_time)
                logger.info(
                    f"Pending session recorded for {file_key} from {ip} "
                    f"(initial buffer: {range_header}). Waiting for play confirmation."
                )
                return "skip"

        # 2. Existing Session: Check if expired past dedupe_window
        if current_time - session["last_activity_time"] > self.dedupe_window:
            session["start_time"] = current_time
            session["last_heartbeat_time"] = current_time
            session["last_activity_time"] = current_time
            session["chunks_count"] = 1
            if is_full_or_large_request:
                session["confirmed"] = True
                return "play"
            else:
                session["confirmed"] = False
                session["first_range_end"] = end_byte or 0
                return "skip"

        # Update activity timestamp
        session["last_activity_time"] = current_time
        session["chunks_count"] = session.get("chunks_count", 0) + 1

        # 3. Session is not yet confirmed (was an initial pre-buffer)
        if not session.get("confirmed", False):
            is_subsequent_chunk = start_byte is not None and start_byte > 0
            has_multiple_chunks = session["chunks_count"] >= 2
            time_elapsed = current_time - session["start_time"]

            # Confirm play if client requests beyond byte 0 or makes multiple requests over time
            if (
                is_full_or_large_request
                or is_subsequent_chunk
                or (has_multiple_chunks and time_elapsed >= 2)
            ):
                session["confirmed"] = True
                session["last_heartbeat_time"] = current_time
                logger.info(
                    f"Confirmed active play for {file_key} from {ip} "
                    f"(chunk {session['chunks_count']}, range={range_header}, elapsed={time_elapsed:.1f}s)"
                )
                return "play"

            return "skip"

        # 4. Session is ALREADY confirmed: Check for heartbeat
        if current_time - session.get("last_heartbeat_time", 0) >= 60:
            session["last_heartbeat_time"] = current_time
            return "heartbeat"

        return "skip"

    def clean_cache(self, now):
        """Remove expired entries from cache."""
        unconfirmed_ttl = min(3600, self.dedupe_window)
        self.download_cache = {
            k: v
            for k, v in self.download_cache.items()
            if (
                (
                    v.get("confirmed", False)
                    and now - v["last_activity_time"] < self.dedupe_window
                )
                or (
                    not v.get("confirmed", False)
                    and now - v["last_activity_time"] < unconfirmed_ttl
                )
            )
        }

    def _log_download_async(self, payload, headers, file_key):
        """Helper to send Umami request in background."""
        try:
            logger.info(f"Sending tracking payload to Umami: {payload}")
            response = requests.post(
                self.umami_url, json=payload, headers=headers, timeout=5
            )
            logger.info(
                f"Umami API response for {file_key}: status={response.status_code}, body={response.text}"
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
        logger.info(f"Processing MinIO event data: {data}")

        if not data or "Records" not in data:
            logger.warning("MinIO event payload has no 'Records' key or is empty.")
            return {"status": "ignored"}

        processed_count = 0

        for record in data["Records"]:
            # Only track ObjectAccessed (read/GET) events
            event_name = (
                record.get("eventName")
                or record.get("event")
                or data.get("EventName")
                or ""
            )
            api_info = (
                record.get("api", {}) if isinstance(record.get("api"), dict) else {}
            )
            api_name = api_info.get("name", "")
            trigger = record.get("trigger", "")

            is_access_event = (
                "ObjectAccessed" in event_name
                or api_name == "s3:GetObject"
                or trigger == "s3:GetObject"
            )
            if not is_access_event:
                logger.debug(f"Skipping non-access event: {event_name}")
                continue

            # If API status is reported, ensure it succeeded
            api_status = api_info.get("status")
            if api_status and str(api_status).lower() not in ("success", "ok"):
                logger.debug(f"Skipping unsuccessful API access: {api_status}")
                continue

            # Extract basic info (supports S3 notification & MinIO audit formats)
            s3_info = (
                record.get("s3", {}) if isinstance(record.get("s3"), dict) else {}
            )
            s3_object = (
                s3_info.get("object", {})
                if isinstance(s3_info.get("object"), dict)
                else {}
            )
            s3_bucket = (
                s3_info.get("bucket", {})
                if isinstance(s3_info.get("bucket"), dict)
                else {}
            )

            file_key = s3_object.get("key") or api_info.get("object")
            if not file_key:
                logger.warning(
                    f"Skipping record due to missing object metadata: {record}"
                )
                continue

            # 1. Only track MP3s
            if not file_key.endswith(".mp3"):
                logger.debug(f"Skipping non-MP3 file download event: {file_key}")
                continue

            # Handle bucket name safely
            bucket_name = (
                s3_bucket.get("name")
                or api_info.get("bucket")
                or "unknown"
            )

            # Get request parameters safely
            request_params = (
                record.get("requestParameters", {})
                if isinstance(record.get("requestParameters"), dict)
                else {}
            )
            request_query = (
                record.get("requestQuery", {})
                if isinstance(record.get("requestQuery"), dict)
                else {}
            )

            client_ip = (
                request_params.get("sourceIPAddress")
                or request_query.get("x-real-ip")
                or request_query.get("x-forwarded-for")
                or record.get("remotehost")
                or "0.0.0.0"
            )
            if isinstance(client_ip, str):
                if "," in client_ip:
                    client_ip = client_ip.split(",")[0].strip()
                if ":" in client_ip and client_ip.count(":") == 1:
                    client_ip = client_ip.split(":")[0]

            # Extract visitor User-Agent from source or direct field
            source_info = (
                record.get("source", {})
                if isinstance(record.get("source"), dict)
                else {}
            )
            user_agent = (
                record.get("userAgent")
                or source_info.get("userAgent")
                or request_params.get("userAgent")
                or request_query.get("user-agent")
            )

            # Skip events triggered by scripts/tools (boto3, botocore, minio clients, rclone, curl, etc.)
            if user_agent and isinstance(user_agent, str):
                ua_lower = user_agent.lower()
                if any(
                    ignored in ua_lower
                    for ignored in [
                        "boto3",
                        "botocore",
                        "minio",
                        "rclone",
                        "curl",
                        "wget",
                        "http.client",
                    ]
                ):
                    continue

            # Skip known indexing crawlers, bots, or aggregators
            if self._is_crawler(user_agent):
                logger.info(
                    f"Skipping crawler/bot request for {file_key} from {user_agent}"
                )
                continue

            # Exclude metadata checks (e.g. range requests downloading less than 500 KB)
            response_elements = (
                record.get("responseElements", {})
                if isinstance(record.get("responseElements"), dict)
                else {}
            )
            response_header = (
                record.get("responseHeader", {})
                if isinstance(record.get("responseHeader"), dict)
                else {}
            )
            content_length_str = (
                response_elements.get("content-length")
                or response_header.get("content-length")
            )
            content_length = None
            if content_length_str:
                try:
                    content_length = int(content_length_str)
                    if content_length < 500 * 1024:
                        logger.info(
                            f"Skipping metadata range check (downloaded {content_length} bytes) for {file_key}"
                        )
                        continue
                except ValueError:
                    content_length = None

            range_header = request_query.get("range") or record.get(
                "requestHeaders", {}
            ).get("range")
            if (
                range_header
                and isinstance(range_header, str)
                and range_header.startswith("bytes=")
            ):
                try:
                    parts = range_header.replace("bytes=", "").split("-")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        range_bytes = int(parts[1]) - int(parts[0]) + 1
                        if range_bytes < 500 * 1024:
                            logger.info(
                                f"Skipping metadata range check ({range_bytes} bytes from range header) for {file_key}"
                            )
                            continue
                except Exception:
                    pass

            logger.info(
                f"MinIO event details: bucket={bucket_name}, file_key={file_key}, "
                f"client_ip={client_ip}, user_agent={user_agent}"
            )

            if not user_agent or not isinstance(user_agent, str):
                user_agent = (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0"
                )

            # 2. SESSION TRACKING & DEDUPLICATION (IAB v2.1 stream confirmation)
            action = self.evaluate_session_action(
                client_ip,
                user_agent,
                file_key,
                range_header=range_header,
                content_length=content_length,
            )
            if action == "skip":
                logger.info(
                    f"Skipping unconfirmed buffer or duplicate range request for file_key={file_key} from client_ip={client_ip}"
                )
                continue

            if bucket_name not in self.bucket_map:
                logger.warning(
                    f"Ignored event from unknown or unmapped bucket: {bucket_name}. "
                    f"Mapped buckets: {list(self.bucket_map.keys())}"
                )
                continue

            bucket_info = self.bucket_map[bucket_name]
            website_id = self.umami_website_id
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

            # 3. Send to Umami (Pageview/Heartbeat event payload)
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

            # If it's a heartbeat, include the event name to extend the session
            # without duplicating the pageviews count in the Umami dashboard.
            if action == "heartbeat":
                payload["payload"]["name"] = "Podcast Heartbeat"

            # To prevent Umami from filtering out non-browser traffic (like podcast players) as bots/crawlers,
            # we map the parsed OS to a standard, human-browser User-Agent.
            synthetic_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            if ua_details["podcast_os"] == "iOS":
                synthetic_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
            elif ua_details["podcast_os"] == "Android":
                synthetic_ua = "Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
            elif ua_details["podcast_os"] == "macOS":
                synthetic_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15"

            headers = {
                "User-Agent": synthetic_ua,
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
