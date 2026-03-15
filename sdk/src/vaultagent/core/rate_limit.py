"""Rate limiting for agent tool calls."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from threading import Lock

from vaultagent.core.policy import RateLimit


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""

    allowed: bool
    limit_type: str | None = None  # "minute" / "hour" / "day"
    current_count: int = 0
    max_allowed: int = 0
    retry_after_seconds: float | None = None


class RateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(self) -> None:
        self._calls: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, agent_id: str, rate_limit: RateLimit) -> RateLimitResult:
        """Check if the agent is within rate limits."""
        now = time.time()

        with self._lock:
            # Clean old entries
            self._calls[agent_id] = [
                t for t in self._calls[agent_id] if now - t < 86400  # Keep 24h
            ]

            calls = self._calls[agent_id]

            # Check per-minute limit
            if rate_limit.max_calls_per_minute is not None:
                recent_minute = sum(1 for t in calls if now - t < 60)
                if recent_minute >= rate_limit.max_calls_per_minute:
                    oldest_in_window = min(
                        (t for t in calls if now - t < 60), default=now
                    )
                    return RateLimitResult(
                        allowed=False,
                        limit_type="minute",
                        current_count=recent_minute,
                        max_allowed=rate_limit.max_calls_per_minute,
                        retry_after_seconds=60 - (now - oldest_in_window),
                    )

            # Check per-hour limit
            if rate_limit.max_calls_per_hour is not None:
                recent_hour = sum(1 for t in calls if now - t < 3600)
                if recent_hour >= rate_limit.max_calls_per_hour:
                    oldest_in_window = min(
                        (t for t in calls if now - t < 3600), default=now
                    )
                    return RateLimitResult(
                        allowed=False,
                        limit_type="hour",
                        current_count=recent_hour,
                        max_allowed=rate_limit.max_calls_per_hour,
                        retry_after_seconds=3600 - (now - oldest_in_window),
                    )

            # Check per-day limit
            if rate_limit.max_calls_per_day is not None:
                recent_day = len(calls)
                if recent_day >= rate_limit.max_calls_per_day:
                    oldest_in_window = min(
                        (t for t in calls if now - t < 86400), default=now
                    )
                    return RateLimitResult(
                        allowed=False,
                        limit_type="day",
                        current_count=recent_day,
                        max_allowed=rate_limit.max_calls_per_day,
                        retry_after_seconds=86400 - (now - oldest_in_window),
                    )

            # Record this call
            self._calls[agent_id].append(now)

        return RateLimitResult(allowed=True)

    def reset(self, agent_id: str | None = None) -> None:
        """Reset rate limit counters."""
        with self._lock:
            if agent_id:
                self._calls.pop(agent_id, None)
            else:
                self._calls.clear()
