import logging
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

    def get_channel_videos(self, channel_urls):
        """
        Fetches basic video info from a list of channel URLs.
        Returns a list of dicts with id, url, title, upload_date.
        """
        video_items = []

        # Ensure input is a list
        if isinstance(channel_urls, str):
            channel_urls = [channel_urls]

        with yt_dlp.YoutubeDL(dict(self._get_base_opts(), extract_flat=True)) as ydl:
            for url in channel_urls:
                if not url:
                    continue
                logger.info(f"Fetching videos from: {url}")
                try:
                    info = ydl.extract_info(url, download=False)
                    entries = info.get("entries", [])
                    logger.info(f"Found {len(entries)} videos.")
                    for entry in entries:
                        if entry and "id" in entry:
                            video_items.append(
                                {
                                    "id": entry["id"],
                                    "url": entry.get("url")
                                    or f"https://www.youtube.com/watch?v={entry['id']}",
                                    "title": entry.get("title"),
                                    "upload_date": entry.get("upload_date"),
                                }
                            )
                except Exception as e:
                    logger.error(f"Error fetching channel {url}: {e}", exc_info=True)

        return video_items

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
