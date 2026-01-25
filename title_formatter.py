"""
Title Formatter Module

Simple validation of AI-generated title components against the original video title.

Rules:
1. If AI provides series_name → verify it exists in original title (fuzzy), else drop
2. If AI provides episode_number → verify it exists in original title, else drop
3. Combine valid components to create the final title
"""

import re
from thefuzz import fuzz

# Minimum fuzzy match score for series name validation
SERIES_MATCH_THRESHOLD = 80


def _extract_numbers(text: str) -> list[str]:
    """Extract all numbers from text."""
    if not text:
        return []
    return re.findall(r"\d+", text)


def _series_exists_in_title(original_title: str, series_name: str) -> bool:
    """Check if series_name exists in original title using fuzzy matching."""
    if not series_name or not original_title:
        return False

    # Direct fuzzy partial match
    score = fuzz.partial_ratio(series_name.lower(), original_title.lower())
    if score >= SERIES_MATCH_THRESHOLD:
        return True

    # Also check if major parts of series name exist
    parts = re.split(r"[\s\-–—|:]+", series_name)
    significant_parts = [p for p in parts if len(p) > 2]

    if not significant_parts:
        return False

    matches = sum(
        1
        for p in significant_parts
        if fuzz.partial_ratio(p.lower(), original_title.lower())
        >= SERIES_MATCH_THRESHOLD
    )
    return matches >= len(significant_parts) * 0.5


def _episode_exists_in_title(original_title: str, episode_number: str) -> bool:
    """Check if episode_number exists in original title."""
    if not episode_number or not original_title:
        return False

    # Extract numbers from both
    episode_nums = _extract_numbers(episode_number)
    title_nums = _extract_numbers(original_title)

    if not episode_nums:
        return False

    # Check if any episode number appears in title
    for ep_num in episode_nums:
        if ep_num in title_nums:
            return True
        # Handle leading zeros: "01" should match "1"
        if ep_num.lstrip("0") in [n.lstrip("0") for n in title_nums]:
            return True

    return False


def format_title(original_title: str, title_components: dict) -> str:
    """
    Validate and format title from AI components.

    Args:
        original_title: The original video title from YouTube
        title_components: Dict with series_name, episode_number, topic_summary

    Returns:
        The formatted title string
    """
    if not title_components:
        return original_title

    series_name = title_components.get("series_name")
    episode_number = title_components.get("episode_number")
    topic_summary = title_components.get("topic_summary")

    # Validate and drop if not found in original
    if series_name and not _series_exists_in_title(original_title, series_name):
        series_name = None

    if episode_number and not _episode_exists_in_title(original_title, episode_number):
        episode_number = None

    # Build title from valid components
    if not topic_summary:
        return original_title

    if series_name and episode_number:
        return f"{series_name} {episode_number} | {topic_summary}"
    elif series_name:
        return f"{series_name} | {topic_summary}"
    else:
        return topic_summary


def get_safe_title(original_title: str, ai_response: dict) -> str:
    """
    Get a validated title from AI response.

    Args:
        original_title: The original video title from YouTube
        ai_response: The full AI response dict containing title_components

    Returns:
        The formatted title string
    """
    if not ai_response:
        return original_title

    title_components = ai_response.get("title_components")
    if title_components:
        return format_title(original_title, title_components)

    return original_title
