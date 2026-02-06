def format_hierarchical_title(
    original_title: str,
    series_name: str = None,
    episode_number: str = None,
    topic_summary: str = None,
) -> str:
    # Build title from valid components
    if not topic_summary:
        return original_title

    if series_name and episode_number is not None:
        try:
            # Zero-pad to 3 digits if numeric for better UX/sorting
            ep_num = int(episode_number)
            episode_display = f"{ep_num:03d}"
        except ValueError:
            episode_display = episode_number

        return f"[{series_name} | {episode_display}] {topic_summary}"
    elif series_name:
        return f"[{series_name}] {topic_summary}"
    else:
        return topic_summary


def format_display_title(
    original_title: str,
    series_path: list = None,
    episode_number: str = None,
    topic_summary: str = None,
) -> str:
    if not topic_summary:
        return original_title

    # 1. Episode Part
    episode_part = ""
    if episode_number is not None:
        try:
            ep_num = int(episode_number)
            episode_display = f"{ep_num:03d}"
        except ValueError:
            episode_display = episode_number
        episode_part = f"{episode_display} - "

    # 2. Series Part (Leaf only)
    series_part = ""
    if series_path and len(series_path) > 0:
        # Use the last item in the path (leaf)
        leaf_series = series_path[-1]
        series_part = f"{leaf_series} | "

    # Combine: "094 - Nama Dhamma | Topic"
    return f"{episode_part}{series_part}{topic_summary}"
