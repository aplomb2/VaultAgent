"""VaultAgent — the main entry point."""

from __future__ import annotations

import functools
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

from vaultagent.core.audit import AuditLogger
from vaultagent.core.decision import Decision, DecisionResult
from vaultagent.core.policy import Action, Policy
from vaultagent.core.rate_limit import RateLimiter

F = TypeVar("F", bound=Callable[..., Any])


class VaultAgentError(Exception):
    """Base exception for VaultAgent."""


class PermissionDeniedError(VaultAgentError):
    """Raised when a tool call is denied by policy."""

    def __init__(self, result: DecisionResult) -> None:
        self.result = result
        super().__init__(
            f"Permission denied: tool '{result.tool}' is not allowed "
            f"for agent '{result.agent_id}'. Reason: {result.denial_reason}"
        )


class ApprovalRequiredError(VaultAgentError):
    """Raised when a tool call requires human approval."""

    def __init__(self, result: DecisionResult) -> None:
        self.result = result
        super().__init__(
            f"Approval required: tool '{result.tool}' needs human approval "
            f"for agent '{result.agent_id}'."
        )


class RateLimitExceededError(VaultAgentError):
    """Raised when rate limit is exceeded."""

    def __init__(self, agent_id: str, limit_type: str, retry_after: float | None) -> None:
        self.agent_id = agent_id
        self.limit_type = limit_type
        self.retry_after = retry_after
        msg = f"Rate limit exceeded for agent '{agent_id}' ({limit_type} limit)"
        if retry_after:
            msg += f". Retry after {retry_after:.0f}s"
        super().__init__(msg)


class VaultAgent:
    """
    Main VaultAgent class.

    Usage:
        # Local policy
        vault = VaultAgent(policy="vaultagent.policy.yaml")

        # Cloud mode
        vault = VaultAgent(api_key="va_sk_xxx", agent_id="my-agent")

        # Protect a tool
        @vault.protect()
        def send_email(to, subject, body):
            ...
    """

    def __init__(
        self,
        policy: str | Path | Policy | None = None,
        api_key: str | None = None,
        agent_id: str | None = None,
        audit_file: str | Path | None = None,
        redact_input: bool = False,
        session_id: str | None = None,
    ) -> None:
        """
        Initialize VaultAgent.

        Args:
            policy: Path to YAML policy file, or a Policy object
            api_key: API key for VaultAgent Cloud
            agent_id: Default agent ID (can be overridden per-call)
            audit_file: Path to local audit log file (JSONL)
            redact_input: If True, hash inputs instead of logging them
            session_id: Default session ID for audit logs
        """
        self._api_key = api_key
        self._default_agent_id = agent_id
        self._session_id = session_id
        self._cloud_reporter = None

        # Load policy
        if isinstance(policy, Policy):
            self._policy = policy
        elif isinstance(policy, (str, Path)):
            self._policy = Policy.from_file(policy)
        elif api_key:
            # TODO: Fetch policy from cloud
            self._policy = Policy()  # Empty policy, will be fetched
        else:
            # Default: deny everything
            self._policy = Policy()

        # Initialize components
        self._decision = Decision(self._policy)
        self._rate_limiter = RateLimiter()

        # Setup cloud reporter if API key provided
        if api_key:
            try:
                from vaultagent.cloud.client import CloudReporter
                self._cloud_reporter = CloudReporter(api_key=api_key)
            except ImportError:
                pass

        # Audit logger
        self._audit = AuditLogger(
            file_path=audit_file or (None if api_key else "vaultagent-audit.jsonl"),
            cloud_reporter=self._cloud_reporter,
            redact_input=redact_input,
        )

    def check(
        self,
        tool_name: str,
        tool_args: dict[str, Any] | None = None,
        agent_id: str | None = None,
    ) -> DecisionResult:
        """
        Check if a tool call is allowed (without executing it).

        Args:
            tool_name: Name of the tool
            tool_args: Arguments to the tool
            agent_id: Agent making the call (uses default if not specified)

        Returns:
            DecisionResult

        Raises:
            PermissionDeniedError: If the call is denied
            ApprovalRequiredError: If the call needs approval
            RateLimitExceededError: If rate limit exceeded
        """
        aid = agent_id or self._default_agent_id or "unknown"
        start = time.monotonic()

        # Check rate limit
        agent_policy = self._policy.get_agent_policy(aid)
        if agent_policy:
            rl_result = self._rate_limiter.check(aid, agent_policy.rate_limits)
            if not rl_result.allowed:
                latency_ms = int((time.monotonic() - start) * 1000)
                result = DecisionResult(
                    action=Action.DENY,
                    tool=tool_name,
                    agent_id=aid,
                    denial_reason=(
                        f"Rate limit exceeded ({rl_result.limit_type}): "
                        f"{rl_result.current_count}/{rl_result.max_allowed}"
                    ),
                )
                self._audit.log(result, self._session_id, tool_args, latency_ms)
                raise RateLimitExceededError(
                    aid, rl_result.limit_type or "unknown", rl_result.retry_after_seconds
                )

        # Check policy
        result = self._decision.evaluate(aid, tool_name, tool_args)
        latency_ms = int((time.monotonic() - start) * 1000)

        # Log
        self._audit.log(result, self._session_id, tool_args, latency_ms)

        return result

    def enforce(
        self,
        tool_name: str,
        tool_args: dict[str, Any] | None = None,
        agent_id: str | None = None,
    ) -> DecisionResult:
        """
        Check and enforce — raises exceptions for deny/approval.

        Same as check() but raises on deny or approval_required.
        """
        result = self.check(tool_name, tool_args, agent_id)

        if result.denied:
            raise PermissionDeniedError(result)
        if result.needs_approval:
            raise ApprovalRequiredError(result)

        return result

    def protect(
        self,
        tool_name: str | None = None,
        agent_id: str | None = None,
    ) -> Callable[[F], F]:
        """
        Decorator to protect a tool function.

        Usage:
            @vault.protect()
            def send_email(to, subject, body):
                ...

            @vault.protect(tool_name="custom.name", agent_id="my-agent")
            def my_tool(**kwargs):
                ...
        """

        def decorator(func: F) -> F:
            resolved_name = tool_name or func.__name__

            @functools.wraps(func)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                # Build tool_args from kwargs (best effort)
                self.enforce(resolved_name, kwargs, agent_id)
                return func(*args, **kwargs)

            return wrapper  # type: ignore[return-value]

        return decorator

    def flush(self) -> None:
        """Flush pending audit events to cloud."""
        self._audit.flush()

    @property
    def policy(self) -> Policy:
        """Get the current policy."""
        return self._policy

    def update_policy(self, policy: Policy) -> None:
        """Update the policy at runtime."""
        self._policy = policy
        self._decision = Decision(policy)
