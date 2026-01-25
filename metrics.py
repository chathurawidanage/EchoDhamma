from prometheus_client import Counter

# Prometheus metrics counters
attempt_counter = Counter(
    "sync_attempts_total", "Total number of sync attempts", ["thero"]
)
success_counter = Counter(
    "sync_success_total",
    "Total number of successful syncs",
    ["thero"],
)
skipped_counter = Counter(
    "sync_skipped_total",
    "Total number of skipped videos",
    ["thero", "reason"],
)
failure_counter = Counter(
    "sync_failure_total", "Total number of sync failures", ["thero"]
)
ai_failure_counter = Counter(
    "ai_failure_total",
    "Total number of AI generation failures",
    ["thero"],
)
ai_rate_limited_counter = Counter(
    "ai_rate_limited_total",
    "Total number of AI rate limit occurrences",
    ["thero"],
)
sync_run_counter = Counter(
    "sync_runs_total",
    "Total number of times the sync workflow is initiated",
    ["thero"],
)
filtered_items_counter = Counter(
    "sync_filtered_items_total",
    "Total number of items filtered out from RSS feed",
    ["thero"],
)
