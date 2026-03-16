"""Audit logging — record every tool call decision for compliance."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from vaultagent.core.decision import DecisionResult

logger = logging.getLogger("vaultagent.audit")


@dataclass
class AuditEvent:
    """A single audit log entry."""

    timestamp: str
    agent_id: str
    tool: str
    action: str  # allowed / denied / pending_approval
    session_id: str | None = None
    input_args: dict[str, Any] | None = None
    input_hash: str | None = None  # SHA-256 of input (when input is redacted)
    output_hash: str | None = None
    constraints_applied: list[str] = field(default_factory=list)
    denial_reason: str | None = None
    latency_ms: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Remove None values
        return {k: v for k, v in d.items() if v is not None}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @classmethod
    def from_decision(
        cls,
        result: DecisionResult,
        session_id: str | None = None,
        input_args: dict[str, Any] | None = None,
        latency_ms: int | None = None,
        redact_input: bool = False,
    ) -> AuditEvent:
        """Create an AuditEvent from a DecisionResult."""
        input_hash = None
        logged_args = input_args

        if redact_input and input_args:
            input_hash = hashlib.sha256(
                json.dumps(input_args, sort_keys=True).encode()
            ).hexdigest()
            logged_args = None

        return cls(
            timestamp=result.timestamp.isoformat(),
            agent_id=result.agent_id,
            tool=result.tool,
            action=result.action.value,
            session_id=session_id,
            input_args=logged_args,
            input_hash=input_hash,
            constraints_applied=result.constraints_applied,
            denial_reason=result.denial_reason,
            latency_ms=latency_ms,
        )


class AuditLogger:
    """Manages audit log destinations."""

    def __init__(
        self,
        file_path: str | Path | None = None,
        cloud_reporter: Any | None = None,
        redact_input: bool = False,
    ) -> None:
        self.file_path = Path(file_path) if file_path else None
        self.cloud_reporter = cloud_reporter
        self.redact_input = redact_input
        self._buffer: list[AuditEvent] = []
        self._buffer_size = 100  # Flush every 100 events

        # Ensure file directory exists
        if self.file_path:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def log(
        self,
        result: DecisionResult,
        session_id: str | None = None,
        input_args: dict[str, Any] | None = None,
        latency_ms: int | None = None,
    ) -> AuditEvent:
        """Log a decision result."""
        event = AuditEvent.from_decision(
            result=result,
            session_id=session_id,
            input_args=input_args,
            latency_ms=latency_ms,
            redact_input=self.redact_input,
        )

        # Log to file
        if self.file_path:
            self._write_to_file(event)

        # Log to Python logger
        log_msg = (
            f"[{event.action}] agent={event.agent_id} "
            f"tool={event.tool}"
        )
        if event.denial_reason:
            log_msg += f" reason={event.denial_reason}"
        if event.latency_ms is not None:
            log_msg += f" latency={event.latency_ms}ms"

        if event.action == "denied":
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        # Buffer for cloud reporting
        if self.cloud_reporter:
            self._buffer.append(event)
            if len(self._buffer) >= self._buffer_size:
                self.flush()

        return event

    def flush(self) -> None:
        """Flush buffered events to cloud."""
        if self.cloud_reporter and self._buffer:
            try:
                self.cloud_reporter.send_events(self._buffer)
            except Exception as e:
                logger.error(f"Failed to send audit events to cloud: {e}")
            finally:
                self._buffer.clear()

    def _write_to_file(self, event: AuditEvent) -> None:
        """Append event to audit log file (JSONL format)."""
        if self.file_path:
            with open(self.file_path, "a") as f:
                f.write(event.to_json() + "\n")
