"""VaultAgent middleware for Anthropic client integration.

Wraps the Anthropic client so that every ``tool_use`` content block in a
messages response is checked against VaultAgent policies before being
returned to the caller.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from vaultagent.core.vault import (
    ApprovalRequiredError,
    PermissionDeniedError,
    RateLimitExceededError,
    VaultAgent,
    VaultAgentError,
)

if TYPE_CHECKING:
    import anthropic

logger = logging.getLogger("vaultagent.middleware.anthropic")


def wrap_anthropic(
    client: anthropic.Anthropic | anthropic.AsyncAnthropic,
    vault: VaultAgent,
    *,
    agent_id: str | None = None,
    on_denied: str = "raise",
) -> anthropic.Anthropic | anthropic.AsyncAnthropic:
    """Wrap an Anthropic client to enforce VaultAgent policies on tool use.

    The returned object is a transparent proxy: ``client.messages.create(...)``
    continues to work exactly as before, but every ``tool_use`` block in the
    response is validated against the configured VaultAgent policy.

    Args:
        client: An ``anthropic.Anthropic`` or ``anthropic.AsyncAnthropic`` instance.
        vault: The :class:`VaultAgent` instance that holds the active policy.
        agent_id: Optional agent identifier forwarded to ``vault.enforce``.
        on_denied: What to do when a tool call is denied.  ``"raise"`` (default)
            re-raises the VaultAgent exception.  ``"drop"`` silently removes the
            denied tool_use block from the response content.

    Returns:
        A wrapped client with the same public interface.

    Raises:
        PermissionDeniedError: If *on_denied* is ``"raise"`` and a tool use
            is blocked by policy.
        ApprovalRequiredError: If human approval is required.
        RateLimitExceededError: If the agent has exceeded its rate limit.
    """
    if on_denied not in ("raise", "drop"):
        raise ValueError(f"on_denied must be 'raise' or 'drop', got {on_denied!r}")

    try:
        import anthropic as _anthropic  # noqa: F811
    except ImportError as exc:
        raise ImportError(
            "The 'anthropic' package is required for this middleware. "
            "Install it with: pip install anthropic"
        ) from exc

    is_async = isinstance(client, _anthropic.AsyncAnthropic)

    if is_async:
        return _AsyncAnthropicProxy(client, vault, agent_id=agent_id, on_denied=on_denied)  # type: ignore[return-value]
    return _SyncAnthropicProxy(client, vault, agent_id=agent_id, on_denied=on_denied)  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _enforce_tool_use_blocks(
    vault: VaultAgent,
    response: Any,
    *,
    agent_id: str | None,
    on_denied: str,
) -> Any:
    """Validate every ``tool_use`` block in the Anthropic *response*.

    Anthropic messages have a ``content`` list where each element can be a
    ``TextBlock`` or ``ToolUseBlock``.  Tool use blocks expose ``type``,
    ``id``, ``name``, and ``input`` attributes.
    """
    content = getattr(response, "content", None)
    if not content:
        return response

    kept: list[Any] = []
    for block in content:
        block_type = getattr(block, "type", None)
        if block_type != "tool_use":
            kept.append(block)
            continue

        tool_name: str = getattr(block, "name", "")
        tool_input: dict[str, Any] = getattr(block, "input", {}) or {}

        try:
            vault.enforce(tool_name, tool_input, agent_id=agent_id)
            logger.debug("Tool use '%s' allowed by policy.", tool_name)
            kept.append(block)
        except (PermissionDeniedError, ApprovalRequiredError, RateLimitExceededError):
            logger.warning("Tool use '%s' denied by VaultAgent policy.", tool_name)
            if on_denied == "raise":
                raise
            # on_denied == "drop": silently omit this block
        except VaultAgentError:
            logger.exception("Unexpected VaultAgent error for tool '%s'.", tool_name)
            if on_denied == "raise":
                raise

    # Replace content with filtered blocks when dropping.
    if on_denied == "drop":
        response.content = kept

    return response


# ---------------------------------------------------------------------------
# Proxy objects
# ---------------------------------------------------------------------------

class _MessagesNamespace:
    """Sync proxy for ``client.messages`` that intercepts ``create``."""

    def __init__(
        self,
        original_messages: Any,
        vault: VaultAgent,
        *,
        agent_id: str | None,
        on_denied: str,
    ) -> None:
        self._original = original_messages
        self._vault = vault
        self._agent_id = agent_id
        self._on_denied = on_denied

    def create(self, **kwargs: Any) -> Any:
        """Call the original ``messages.create`` and enforce policies on the result."""
        response = self._original.create(**kwargs)
        return _enforce_tool_use_blocks(
            self._vault,
            response,
            agent_id=self._agent_id,
            on_denied=self._on_denied,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._original, name)


class _AsyncMessagesNamespace:
    """Async proxy for ``client.messages``."""

    def __init__(
        self,
        original_messages: Any,
        vault: VaultAgent,
        *,
        agent_id: str | None,
        on_denied: str,
    ) -> None:
        self._original = original_messages
        self._vault = vault
        self._agent_id = agent_id
        self._on_denied = on_denied

    async def create(self, **kwargs: Any) -> Any:
        """Await the original ``messages.create`` and enforce policies."""
        response = await self._original.create(**kwargs)
        return _enforce_tool_use_blocks(
            self._vault,
            response,
            agent_id=self._agent_id,
            on_denied=self._on_denied,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._original, name)


class _SyncAnthropicProxy:
    """Transparent proxy around ``anthropic.Anthropic``."""

    def __init__(
        self,
        client: Any,
        vault: VaultAgent,
        *,
        agent_id: str | None,
        on_denied: str,
    ) -> None:
        self._client = client
        self._vault = vault
        self._agent_id = agent_id
        self._on_denied = on_denied
        self._messages = _MessagesNamespace(
            client.messages,
            vault,
            agent_id=agent_id,
            on_denied=on_denied,
        )

    @property
    def messages(self) -> _MessagesNamespace:
        return self._messages

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


class _AsyncAnthropicProxy:
    """Transparent proxy around ``anthropic.AsyncAnthropic``."""

    def __init__(
        self,
        client: Any,
        vault: VaultAgent,
        *,
        agent_id: str | None,
        on_denied: str,
    ) -> None:
        self._client = client
        self._vault = vault
        self._agent_id = agent_id
        self._on_denied = on_denied
        self._messages = _AsyncMessagesNamespace(
            client.messages,
            vault,
            agent_id=agent_id,
            on_denied=on_denied,
        )

    @property
    def messages(self) -> _AsyncMessagesNamespace:
        return self._messages

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)
