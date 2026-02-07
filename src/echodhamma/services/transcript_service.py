from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs
import logging

logger = logging.getLogger(__name__)


def get_video_id(url):
    """
    Extracts the video ID from a YouTube URL.
    Supports:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    """
    parsed = urlparse(url)
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
    if parsed.hostname == "youtu.be":
        return parsed.path[1:]
    return None


def format_timestamp(seconds):
    """Converts seconds to HH:MM:SS string."""
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}"


class TranscriptsDisabledError(Exception):
    """Raised when subtitles are disabled for a video."""

    pass


def get_transcript_text(url):
    """
    Fetches the transcript for a given YouTube URL and returns it as a formatted string.
    Returns None if retrieval fails.
    Raises TranscriptsDisabledError if subtitles are disabled.
    """
    video_id = get_video_id(url)
    if not video_id:
        logger.error(f"Error: Could not extract video ID from URL: {url}")
        return None

    logger.info(f"Fetching transcript for Video ID: {video_id} ...")

    try:
        ytt = YouTubeTranscriptApi()
        transcript_data = ytt.fetch(video_id, languages=["si", "en"])

        output_lines = []
        for entry in transcript_data:
            start = getattr(entry, "start", None)
            text = getattr(entry, "text", None)

            if start is None and hasattr(entry, "get"):
                start = entry.get("start")
                text = entry.get("text")

            if start is not None and text is not None:
                start_str = format_timestamp(float(start))
                text = text.replace("\n", " ")
                output_lines.append(f"[{start_str}] {text}")

        return "\n".join(output_lines)

    except Exception as e:
        error_msg = str(e)
        if "Subtitles are disabled for this video" in error_msg:
            raise TranscriptsDisabledError(
                f"Subtitles are disabled for video {video_id}"
            )
        logger.error(f"Error fetching transcript: {e}")
        return None
