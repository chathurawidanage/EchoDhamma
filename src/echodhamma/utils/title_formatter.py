def format_hierarchical_title(
    original_title: str,
    series_path: list = None,
    episode_number: str = None,
    topic_summary: str = None,
) -> str:
    # Build title from valid components
    if not topic_summary:
        return original_title

    parts = []

    # helper for episode
    ep_str = ""
    if episode_number is not None:
        try:
            ep_num = int(episode_number)
            ep_str = f"{ep_num:03d}"
        except ValueError:
            ep_str = str(episode_number)

    # 1. Series Path with arrows
    if series_path:
        parts.extend(series_path)

    # 2. Episode + Topic
    if ep_str:
        parts.append(f"{ep_str} {topic_summary}")
    else:
        parts.append(topic_summary)

    return " › ".join(parts)


def format_display_title(
    original_title: str,
    series_path: list = None,
    episode_number: str = None,
    topic_summary: str = None,
) -> str:
    if not topic_summary:
        return original_title

    # Prepare Episode
    ep_str = ""
    if episode_number is not None:
        try:
            ep_num = int(episode_number)
            ep_str = f"{ep_num:03d}"
        except ValueError:
            ep_str = str(episode_number)

    # Prepare Series (Leaf)
    leaf_series = ""
    if series_path and len(series_path) > 0:
        leaf_series = series_path[-1]

    # Construct Prefix: [Series | Ep] or [Series] or [Ep]
    prefix = ""
    if leaf_series and ep_str:
        prefix = f"[{leaf_series} | {ep_str}]"
    elif leaf_series:
        prefix = f"[{leaf_series}]"
    elif ep_str:
        prefix = f"[{ep_str}]"

    if prefix:
        return f"{prefix} {topic_summary}"

    return topic_summary
