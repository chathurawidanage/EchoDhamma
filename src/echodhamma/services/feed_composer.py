import logging
from echodhamma.utils.title_extractor import extract_series_and_episode
from echodhamma.utils.title_formatter import (
    format_display_title,
    format_hierarchical_title,
)
from echodhamma.utils.date_utils import parse_time_to_seconds, get_safe_pub_date

logger = logging.getLogger(__name__)


class FeedComposer:
    def __init__(self, config):
        self.config = config
        self.thero_name = config.get("name", "Unknown")
        self.podcast_config = config.get("podcast", {})
        self.known_series = config.get("known_series", [])

    def format_chapters(self, ai_response):
        """
        Extracts, formats, and sorts chapters from an AI response.
        Enforces 00:00:00 start time.
        """
        chapters = ai_response.get("aligned_chapters")
        if not chapters or not isinstance(chapters, list):
            return None

        formatted_chapters = {"version": "1.2.0", "chapters": []}

        for ch in chapters:
            start = ch.get("start_time")
            # Normalize to HH:MM:SS
            if start and start.count(":") == 1:
                start = f"00:{start}"

            title = ch.get("title")
            is_qa = ch.get("isQ&A")
            description = ch.get("description")

            if start and title:
                if is_qa:
                    title = f"Q&A: {title}"

                chapter_data = {
                    "startTime": parse_time_to_seconds(start),
                    "title": title,
                    "description": description,
                    "is_qa": is_qa,
                    "start_time_str": start,
                }
                formatted_chapters["chapters"].append(chapter_data)

        if not formatted_chapters["chapters"]:
            return None

        formatted_chapters["chapters"].sort(key=lambda x: x["startTime"])

        # Ensure first chapter starts at 0
        if formatted_chapters["chapters"][0]["startTime"] > 0:
            formatted_chapters["chapters"].insert(
                0,
                {
                    "startTime": 0,
                    "title": "ආරම්භය",
                    "description": "",
                    "is_qa": False,
                    "start_time_str": "00:00:00",
                },
            )

        return formatted_chapters

    def prepare_feed_item(self, metadata, video_series_map=None):
        """
        Enhances metadata with display_title and rich description for RSS.
        """
        res = metadata.copy()
        video_series_map = video_series_map or {}

        try:
            original_title = res.get("original_title") or res.get("title")
            video_id = res.get("id")
            description = ""

            ai_data = res.get("ai_response")

            # Dynamic Title Generation
            if ai_data and ai_data.get("title_components"):
                forced_series_path = video_series_map.get(video_id)

                extracted = extract_series_and_episode(
                    original_title,
                    self.known_series,
                    forced_series_path=forced_series_path,
                )

                # 1. Short Title for Feed
                display_title = format_display_title(
                    original_title,
                    series_path=extracted.get("series_match_path"),
                    episode_number=str(extracted.get("episode_number"))
                    if extracted.get("episode_number") is not None
                    else None,
                    topic_summary=ai_data["title_components"].get("topic_summary"),
                )

                # 2. Full Title for Description
                hierarchical_title = format_hierarchical_title(
                    original_title,
                    series_path=extracted.get("series_match_path"),
                    episode_number=str(extracted.get("episode_number"))
                    if extracted.get("episode_number") is not None
                    else None,
                    topic_summary=ai_data["title_components"].get("topic_summary"),
                )

                res["display_title"] = display_title
                description += f"<b>{hierarchical_title}</b><br/><br/>"

            # Append AI description
            if ai_data and ai_data.get("description"):
                description += ai_data["description"]

            # Append Chapters
            if ai_data and ai_data.get("aligned_chapters"):
                formatted = self.format_chapters(ai_data)
                if formatted:
                    res["chapters"] = formatted

                    if description != "":
                        description += "<br/><br/>"

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

            desc_tmp = self.podcast_config.get("description_template", "")
            description += desc_tmp.format(
                title=res.get("title"),
                original_url=res.get("original_url"),
                original_title=original_title,
            )

            res["description"] = description
            return res
        except Exception as e:
            logger.error(
                f"[{self.thero_name}] Error preparing item {res.get('id')}: {e}",
                exc_info=True,
            )
            return None

    def filter_and_sort_items(self, metadata_list):
        """
        Sorts by date and filters invalid items.
        """
        items = [item for item in metadata_list if item is not None]
        items.sort(key=get_safe_pub_date, reverse=True)
        return items
