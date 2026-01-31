import json
import os
from thefuzz import fuzz, process

# Minimum fuzzy match score (0-100) required for a token to be considered a match
FUZZY_MATCH_THRESHOLD = 85


def load_thero_data(file_path):
    """Loads Thero data from a JSON file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Thero data file not found: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def is_thero_in_content(title, description, thero_config):
    """
    Checks if the video title or description contains the expected Thero's name using fuzzy matching.
    """
    matcher = thero_config.get("matcher", {})
    en_tokens = matcher.get("english_tokens", [])
    si_tokens = matcher.get("sinhala_tokens", [])

    if not en_tokens and not si_tokens:
        return True

    # Check English Names in Title or Description
    en_ok = False
    if en_tokens:
        # Check if all tokens are present in either title or description
        en_matches = []
        for token in en_tokens:
            title_score = process.extractOne(token, [title], scorer=fuzz.partial_ratio)[
                1
            ]
            desc_score = (
                process.extractOne(token, [description], scorer=fuzz.partial_ratio)[1]
                if description
                else 0
            )
            en_matches.append(max(title_score, desc_score))
        en_ok = all(s > FUZZY_MATCH_THRESHOLD for s in en_matches)

    # Check Sinhala Names in Title or Description
    si_ok = False
    if si_tokens:
        si_matches = []
        for token in si_tokens:
            title_score = process.extractOne(token, [title], scorer=fuzz.partial_ratio)[
                1
            ]
            desc_score = (
                process.extractOne(token, [description], scorer=fuzz.partial_ratio)[1]
                if description
                else 0
            )
            si_matches.append(max(title_score, desc_score))
        si_ok = all(s > FUZZY_MATCH_THRESHOLD for s in si_matches)

    return en_ok or si_ok
