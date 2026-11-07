import logging
from itertools import zip_longest
import yt_dlp

logger = logging.getLogger(__name__)


class YouTubeClient:
    def __init__(self, user_agent_client="android,ios,web_embedded"):
        self.clients = [c.strip() for c in user_agent_client.split(",")]

    def _get_base_opts(self):
        return {
            "quiet": True,
            "no_warnings": True,
            "extractor_args": {
                "youtube": {
                    "player_client": self.clients,
                    "js_runtime": "node",
                }
            },
        }

    def get_channel_videos(
        self,
        channel_urls,
        existing_ids=None,
        chunk_size=100,
        consecutive_seen_threshold=5,
        max_chunks=50,
    ):
        """
        Fetches basic video info from a list of channel URLs in chunks from newest to oldest.
        If existing_ids is provided, stops crawling each channel once consecutive_seen_threshold
        consecutive already-seen videos are encountered.
        Interleaves videos across multiple channels so latest videos across all channels are processed first.
        Returns a list of dicts with id, url, title, upload_date.
        """
        # Ensure input is a list
        if isinstance(channel_urls, str):
            channel_urls = [channel_urls]

        channel_videos_list = []
        for url in channel_urls:
            if not url:
                continue
            channel_items = self._fetch_channel_videos_chunked(
                url,
                existing_ids=existing_ids,
                chunk_size=chunk_size,
                consecutive_seen_threshold=consecutive_seen_threshold,
                max_chunks=max_chunks,
            )
            channel_videos_list.append(channel_items)

        # Interleave videos across channels (round-robin)
        video_items = []
        seen_ids = set()
        for items_tuple in zip_longest(*channel_videos_list):
            for item in items_tuple:
                if item is not None and item["id"] not in seen_ids:
                    seen_ids.add(item["id"])
                    video_items.append(item)

        return video_items

    def _fetch_channel_videos_chunked(
        self,
        url,
        existing_ids=None,
        chunk_size=100,
        consecutive_seen_threshold=5,
        max_chunks=50,
    ):
        logger.info(f"Fetching videos from: {url}")
        channel_items = []
        start = 1
        chunk_count = 0

        while chunk_count < max_chunks:
            end = start + chunk_size - 1
            opts = dict(self._get_base_opts(), extract_flat=True)
            opts["playliststart"] = start
            opts["playlistend"] = end

            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    entries = info.get("entries", [])
            except Exception as e:
                logger.error(
                    f"Error fetching channel {url} (range {start}-{end}): {e}",
                    exc_info=True,
                )
                break

            if not entries:
                break

            consecutive_seen = 0
            stop_crawling = False

            for entry in entries:
                if not entry or "id" not in entry:
                    continue
                vid_id = entry["id"]

                if existing_ids and vid_id in existing_ids:
                    consecutive_seen += 1
                    if consecutive_seen >= consecutive_seen_threshold:
                        logger.info(
                            f"Hit {consecutive_seen_threshold} consecutive existing videos in {url}. Stopping crawl at {vid_id}."
                        )
                        stop_crawling = True
                        break
                else:
                    consecutive_seen = 0
                    channel_items.append(
                        {
                            "id": vid_id,
                            "url": entry.get("url")
                            or f"https://www.youtube.com/watch?v={vid_id}",
                            "title": entry.get("title"),
                            "upload_date": entry.get("upload_date"),
                        }
                    )

            if stop_crawling or len(entries) < chunk_size:
                break

            start = end + 1
            chunk_count += 1

        logger.info(f"Found {len(channel_items)} candidate videos from {url}.")
        return channel_items

    def index_playlist(self, playlist_id):
        """
        Fetches video IDs from a playlist.
        Returns a list of video IDs.
        """
        video_ids = []
        pl_url = f"https://www.youtube.com/playlist?list={playlist_id}"
        try:
            with yt_dlp.YoutubeDL(
                dict(self._get_base_opts(), extract_flat=True)
            ) as ydl:
                info = ydl.extract_info(pl_url, download=False)
                entries = info.get("entries", [])
                for entry in entries:
                    vid_id = entry.get("id")
                    if vid_id:
                        video_ids.append(vid_id)
        except Exception as e:
            logger.error(f"Failed to index playlist {playlist_id}: {e}")
        return video_ids

    def get_video_info(self, video_url):
        """
        Extracts full info for a single video without downloading.
        """
        with yt_dlp.YoutubeDL(self._get_base_opts()) as ydl:
            return ydl.extract_info(video_url, download=False)

    def download_audio(self, video_url, output_template):
        """
        Downloads audio from video_url using the provided output_tempalte.
        Returns the processed filename.
        """
        opts = self._get_base_opts()
        opts.update(
            {
                "format": "bestaudio/best",
                "outtmpl": output_template,
            }
        )

        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([video_url])
            # We need to extract info again to get the final filename if needed,
            # or rely on the caller knowing the template.
            # But prepare_filename requires the info dict.
            info = ydl.extract_info(video_url, download=False)
            return ydl.prepare_filename(info)
