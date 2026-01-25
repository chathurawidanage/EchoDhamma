import datetime


class RateLimiter:
    """Encapsulates sync‑rate‑limiting logic.

    It stores a small JSON state in the configured S3 bucket (via the provided
    ``S3Manager``) and offers helper methods to decide whether a sync attempt
    should be performed and to update the persisted counters.

    Supports two separate rate limits:
    - Video sync limit (max_videos_per_day): Controls overall video processing
    - AI call limit (max_ai_calls_per_day): Controls AI API usage separately
    """

    def __init__(
        self,
        s3_manager,
        state_file: str,
        max_videos_per_day: int = 999,
        max_ai_calls_per_day: int = 999,
    ):
        self.s3 = s3_manager
        self.state_file = state_file
        self.max_per_day = max_videos_per_day
        self.max_ai_calls_per_day = max_ai_calls_per_day

        # Load persisted state or initialise defaults
        self.state = self.s3.load_state(self.state_file)
        self.state.setdefault("videos_synced_today", 0)
        self.state.setdefault("last_sync_time", None)
        self.state.setdefault("last_sync_date", "")
        # AI call tracking
        self.state.setdefault("ai_calls_today", 0)
        self.state.setdefault("last_ai_call_time", None)

        # Daily Reset Logic (UTC)
        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        if self.state.get("last_sync_date") != today:
            self.state["videos_synced_today"] = 0
            self.state["ai_calls_today"] = 0
            self.state["last_sync_date"] = today

    # ---------------------------------------------------------------------
    # Periodic (time‑based) sync check
    # ---------------------------------------------------------------------
    def _period_seconds(self) -> float:
        """Calculate the minimum interval between two syncs based on the daily
        allowance.
        """
        if not self.max_per_day:
            return float("inf")
        return 24 * 3600 / self.max_per_day

    def _ai_period_seconds(self) -> float:
        """Calculate the minimum interval between two AI calls based on the daily
        AI allowance.
        """
        if not self.max_ai_calls_per_day:
            return float("inf")
        return 24 * 3600 / self.max_ai_calls_per_day

    def can_sync_periodic(self):
        """Return ``(True, 0)`` if enough time has elapsed since the last
        successful sync, otherwise ``(False, minutes_remaining)``.
        """
        last_iso = self.state.get("last_sync_time")
        if not last_iso:
            return True, 0
        last_time = datetime.datetime.fromisoformat(last_iso)
        if last_time.tzinfo is None:
            last_time = last_time.astimezone(datetime.timezone.utc)
        elapsed = (
            datetime.datetime.now(datetime.timezone.utc) - last_time
        ).total_seconds()
        period = self._period_seconds()
        if elapsed >= period:
            return True, 0
        wait_min = int((period - elapsed) / 60) + 1
        return False, wait_min

    def can_ai_call_periodic(self):
        """Return ``(True, 0)`` if enough time has elapsed since the last
        AI call, otherwise ``(False, minutes_remaining)``.
        """
        last_iso = self.state.get("last_ai_call_time")
        if not last_iso:
            return True, 0
        last_time = datetime.datetime.fromisoformat(last_iso)
        if last_time.tzinfo is None:
            last_time = last_time.astimezone(datetime.timezone.utc)
        elapsed = (
            datetime.datetime.now(datetime.timezone.utc) - last_time
        ).total_seconds()
        period = self._ai_period_seconds()
        if elapsed >= period:
            return True, 0
        wait_min = int((period - elapsed) / 60) + 1
        return False, wait_min

    # ---------------------------------------------------------------------
    # Daily‑quota check
    # ---------------------------------------------------------------------
    def can_sync_daily(self) -> bool:
        """True if the daily video quota has not been exhausted."""
        return self.state["videos_synced_today"] < self.max_per_day

    def can_ai_call_daily(self) -> bool:
        """True if the daily AI call quota has not been exhausted."""
        return self.state["ai_calls_today"] < self.max_ai_calls_per_day

    # ---------------------------------------------------------------------
    # State mutation helpers
    # ---------------------------------------------------------------------
    def record_success(self):
        """Increment the daily counter and update the ``last_sync_time``.
        The updated state is persisted to S3.
        """
        self.state["videos_synced_today"] += 1
        self.state["last_sync_time"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        self.s3.save_state(self.state_file, self.state)

    def record_ai_call(self):
        """Increment the AI call counter and update the ``last_ai_call_time``.
        The updated state is persisted to S3.
        """
        self.state["ai_calls_today"] += 1
        self.state["last_ai_call_time"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        self.s3.save_state(self.state_file, self.state)

    def reset_daily_counter(self):
        """Reset the daily counters – useful when the script is started on a new
        day.  This method does **not** write to S3; callers can decide when to
        persist.
        """
        self.state["videos_synced_today"] = 0
        self.state["ai_calls_today"] = 0
