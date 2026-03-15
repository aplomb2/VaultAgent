"""VaultAgent middleware for OpenAI client integration.

Wraps the OpenAI client so that every tool call in a chat completion response
is checked against VaultAgent policies before being returned to the caller.
"""

from __future__ import annotations

import json
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
    import openai

logger = logging.getLogger("vaultagent.middleware.openai")


def wrap_openai(
    client: openai.OpenAI | openai.AsyncOpenAI,
    vault: VaultAgent,
    *,
    agent_id: str | None = None,
    on_denied: str = "raise",
) -> openai.OpenAI | openai.AsyncOpenAI:
    """Wrap an OpenAI client to enforce VaultAgent policies on tool calls.

    The returned object is a transparent proxy: ``client.chat.completions.create(...)``
    continues to work exactly as before, but every tool call in the response is
    validated against the configured VaultAgent policy.

    Args:
        client: An ``openai.OpenAI`` or ``openai.AsyncOpenAI`` instance.
        vault: The :class:`VaultAgent` instance that holds the active policy.
        agent_id: Optional agent identifier forwarded to ``vault.enforce``.
        on_denied: What to do when a tool call is denied.  ``"raise"`` (default)
            re-raises the VaultAgent exception.  ``"drop"`` silently removes the
            denied tool call from the response.

    Returns:
        A wrapped client with the same public interface.

    Raises:
        PermissionDeniedError: If *on_denied* is ``"raise"`` and a tool call
            is blocked by policy.
        ApprovalRequiredError: If human approval is required for a tool call.
        RateLimitExceededError: If the agent has exceeded its rate limit.
    """
    if on_denied not in ("raise", "drop"):
        raise ValueError(f"on_denied must be 'raise' or 'drop', got {on_denied!r}")

    # Detect whether we are wrapping the sync or async client.
    try:
        import openai as _openai  # noqa: F811
    except ImportError as exc:
        raise ImportError(
            "The 'openai' package is required for this middleware. "
            "Install it with: pip install openai"
        ) from exc

    is_async = isinstance(client, _openai.AsyncOpenAI)

    if is_async:
        return _AsyncOpenAIProxy(client, vault, agent_id=agent_id, on_denied=on_denied)  # type: ignore[return-value]
    return _SyncOpenAIProxy(client, vault, agent_id=agent_id, on_denied=on_denied)  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _enforce_tool_calls(
    vault: VaultAgent,
    response: Any,
    *,
    agent_id: str | None,
    on_denied: str,
) -> Any:
    """Validate every tool call in *response* and optionally strip denied ones.

    Mutates *response* in-place when *on_denied* is ``"drop"``.
    """
    for choice in getattr(response, "choices", []):
        message = getattr(choice, "message", None)
        if message is None:
            continue

        tool_calls = getattr(message, "tool_calls", None)
        if not tool_calls:
            continue

        kept: list[Any] = []
        for tc in tool_calls:
            fn = getattr(tc, "function", None)
            if fn is None:
                kept.append(tc)
                continue

            tool_name: str = fn.name
            try:
                tool_args: dict[str, Any] = json.loads(fn.arguments) if fn.arguments else {}
            except (json.JSONDecodeError, TypeError):
                tool_args = {}

            try:
                vault.enforce(tool_name, tool_args, agent_id=agent_id)
                logger.debug("Tool call '%s' allowed by policy.", tool_name)
                kept.append(tc)
            except (PermissionDeniedError, ApprovalRequiredError, RateLimitExceededError):
                logger.warning("Tool call '%s' denied by VaultAgent policy.", tool_name)
                if on_denied == "raise":
                    raise
                # on_denied == "drop": silently omit this tool call
            except VaultAgentError:
                logger.exception("Unexpected VaultAgent error for tool '%s'.", tool_name)
                if on_denied == "raise":
                    raise

        # Replace the tool_calls list with only the allowed ones.
        if on_denied == "drop":
            message.tool_calls = kept if kept else None

    return response


# ---------------------------------------------------------------------------
# Proxy objects
# ---------------------------------------------------------------------------

class _CompletionsNamespace:
    """Proxy for ``client.chat.completions`` that intercepts ``create``."""

    def __init__(
        self,
        original_completions: Any,
        vault: VaultAgent,
        *,
        agent_id: str | None,
        on_denied: str,
    ) -> None:
        self._original = original_completions
        self._vault = vault
        self._agent_id = agent_id
        self._on_denied = on_denied

    def create(self, **kwargs: Any) -> Any:
        """Call the original ``completions.create`` and enforce policies on the result."""
        response = self._original.create(**kwargs)
        return _enforce_tool_calls(
            self._vault,
            response,
            agent_id=self._agent_id,
            on_denied=self._on_denied,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._original, name)


class _AsyncCompletionsNamespace:
    """Async proxy for ``client.chat.completions``."""

    def __init__(
        self,
        original_completions: Any,
        vault: VaultAgent,
        *,
        agent_id: str | None,
        on_denied: str,
    ) -> None:
        self._original = original_completions
        self._vault = vault
        self._agent_id = agent_id
        self._on_denied = on_denied

    async def create(self, **kwargs: Any) -> Any:
        """Await the original ``completions.create`` and enforce policies."""
        response = await self._original.create(**kwargs)
        return _enforce_tool_calls(
            self._vault,
            response,
            agent_id=self._agent_id,
            on_denied=self._on_denied,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._original, name)


class _ChatNamespace:
    """Proxy for ``client.chat`` that injects the completions proxy."""

    def __init__(self, completions_proxy: Any, original_chat: Any) -> None:
        self._completions = completions_proxy
        self._original_chat = original_chat

    @property
    def completions(self) -> Any:
        return self._completions

    def __getattr__(self, name: str) -> Any:
        return getattr(self._original_chat, name)


class _SyncOpenAIProxy:
    """Transparent proxy around ``openai.OpenAI``."""

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
        self._chat = _ChatNamespace(
            _CompletionsNamespace(
                client.chat.completions,
                vault,
                agent_id=agent_id,
                on_denied=on_denied,
            ),
            client.chat,
        )

    @property
    def chat(self) -> _ChatNamespace:
        return self._chat

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


class _AsyncOpenAIProxy:
    """Transparent proxy around ``openai.AsyncOpenAI``."""

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
        self._chat = _ChatNamespace(
            _AsyncCompletionsNamespace(
                client.chat.completions,
                vault,
                agent_id=agent_id,
                on_denied=on_denied,
            ),
            client.chat,
        )

    @property
    def chat(self) -> _ChatNamespace:
        return self._chat

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)
