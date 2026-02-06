import re
from thefuzz import fuzz, process
from difflib import SequenceMatcher


def extract_series_and_episode(title, known_series_list, forced_series_path=None):
    """
    Extracts the series name and episode number from a title based on a list of known series.

    Args:
        title (str): The video title.
        known_series_list (list): List of strings representing known series names.
        forced_series_path (list): Optional list of strings representing the series path (e.g. ["Main", "Sub"]) derived from playlist.

    Returns:
        dict: {
            "series_name": str or None,
            "series_match_path": list,
            "episode_number": int or None,
            "match_score": int
        }
    """
    if not title:
        return {"series_match_path": [], "episode_number": None, "match_score": 0}

    # 1. Identify valid numbers in the title
    numbers = []
    for m in re.finditer(r"\d+", title):
        numbers.append(
            {
                "value": int(m.group()),
                "start": m.start(),
                "end": m.end(),
                "center": (m.start() + m.end()) / 2,
            }
        )

    match_score = 0
    series_center = 0
    series_path = []

    # 2. Determine Series Path
    if forced_series_path:
        # If forced, use it directly. We assume 100% confidence.
        series_path = forced_series_path
        match_score = 100

        # Try to find WHERE this series is in the title to help with episode extraction
        # use the last part of the path (the most specific sub-series)
        target_name = series_path[-1]

        # Simple fuzzy search for location
        seq = SequenceMatcher(None, target_name, title)
        match = seq.find_longest_match(0, len(target_name), 0, len(title))
        if match.size > 0:
            series_center = match.b + (match.size / 2)
        else:
            # If not found (e.g. playlist title differs from video title completely),
            # maybe just assume start of string or don't bias?
            # Let's assume start (0) if not found, usually series is at start.
            series_center = 0

    else:
        # Standard Recursive Match
        def find_best_match_recursive(title_text, series_candidates):
            """
            Recursively finds the best series match and its sub-series.
            Returns: (list_of_names, total_score, match_center)
            """
            best_name = None
            best_score = 0

            # Prepare candidates for fuzzy matching
            # series_candidates is a list of dicts: {"name": "X", "sub_series": [...]}
            candidate_names = [s["name"] for s in series_candidates]

            if not candidate_names:
                return [], 0, 0

            match_result = process.extractOne(
                title_text, candidate_names, scorer=fuzz.partial_ratio
            )

            if match_result:
                matched_name, score = match_result
                if score >= 90:
                    best_name = matched_name
                    best_score = score
                    # Find the object corresponding to this name
                    best_obj = next(
                        (s for s in series_candidates if s["name"] == best_name), None
                    )

            if best_name:
                # Recursively check sub-series
                sub_names, sub_score, sub_center = find_best_match_recursive(
                    title_text, best_obj.get("sub_series", []) if best_obj else []
                )

                # Approximate center of THIS match
                seq = SequenceMatcher(None, best_name, title_text)
                match = seq.find_longest_match(0, len(best_name), 0, len(title_text))
                current_center = match.b + (match.size / 2) if match.size > 0 else 0

                # If sub-series found, use its center (usually closer to episode number?)
                final_center = sub_center if sub_names else current_center

                return [best_name] + sub_names, best_score, final_center

            return [], 0, 0

        series_path, match_score, series_center = find_best_match_recursive(
            title, known_series_list
        )

    if not series_path:
        return {"series_match_path": [], "episode_number": None, "match_score": 0}

    # 3. Find closest number
    best_episode = None
    if numbers:
        if len(numbers) == 1:
            best_episode = numbers[0]["value"]
        else:
            # Find number with min distance to series_center
            min_dist = float("inf")
            for num in numbers:
                dist = abs(num["center"] - series_center)
                if dist < min_dist:
                    min_dist = dist
                    best_episode = num["value"]

    # For backward compatibility / formatter ease, we can also return "series_name" joined
    series_name_str = " | ".join(series_path)

    return {
        "series_name": series_name_str,  # Flattened for display
        "series_match_path": series_path,  # List for granular handling if needed
        "episode_number": best_episode,
        "match_score": match_score,
    }
