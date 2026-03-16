"""VaultAgent middleware for LangChain tool integration.

Wraps LangChain tools so that ``vault.enforce`` is called before every tool
invocation, both synchronous (``_run``) and asynchronous (``_arun``).
"""

from __future__ import annotations

import functools
import logging
from typing import TYPE_CHECKING, Any

from vaultagent.core.vault import VaultAgent

if TYPE_CHECKING:
    from langchain_core.tools import BaseTool

logger = logging.getLogger("vaultagent.middleware.langchain")


def wrap_langchain_tools(
    tools: list[BaseTool],
    vault: VaultAgent,
    *,
    agent_id: str | None = None,
) -> list[BaseTool]:
    """Wrap a list of LangChain tools with VaultAgent policy enforcement.

    Each tool's ``_run`` and ``_arun`` methods are monkey-patched so that
    ``vault.enforce(tool.name, tool_input)`` is called before every
    invocation.  If the policy denies the call, the corresponding VaultAgent
    exception propagates to the caller.

    The original tool objects are **not** modified; shallow copies are created
    instead.

    Args:
        tools: A list of LangChain ``BaseTool`` instances.
        vault: The :class:`VaultAgent` instance that holds the active policy.
        agent_id: Optional agent identifier forwarded to ``vault.enforce``.

    Returns:
        A new list of wrapped tools with the same length and order.

    Raises:
        ImportError: If ``langchain_core`` is not installed.
        PermissionDeniedError: At invocation time if the tool call is denied.
        ApprovalRequiredError: At invocation time if approval is required.
        RateLimitExceededError: At invocation time if rate limit is exceeded.
    """
    try:
        from langchain_core.tools import BaseTool as _BaseTool  # noqa: F811
    except ImportError as exc:
        raise ImportError(
            "The 'langchain-core' package is required for this middleware. "
            "Install it with: pip install langchain-core"
        ) from exc

    wrapped: list[_BaseTool] = []
    for tool in tools:
        wrapped.append(_wrap_single_tool(tool, vault, agent_id=agent_id))
    return wrapped


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalize_tool_input(raw_input: Any) -> dict[str, Any]:
    """Convert the various forms of LangChain tool input to a dict.

    LangChain may pass a plain string, a dict, or keyword arguments to
    ``_run`` / ``_arun``.  This helper normalises them into a dict suitable
    for ``vault.enforce``.
    """
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        return {"input": raw_input}
    return {}


def _wrap_single_tool(
    tool: BaseTool,
    vault: VaultAgent,
    *,
    agent_id: str | None,
) -> BaseTool:
    """Return a shallow copy of *tool* with guarded ``_run`` and ``_arun``."""
    import copy

    wrapped_tool = copy.copy(tool)
    original_run = tool._run
    original_arun = tool._arun
    tool_name: str = tool.name

    @functools.wraps(original_run)
    def guarded_run(*args: Any, **kwargs: Any) -> Any:
        tool_input = _build_tool_args(args, kwargs)
        logger.debug("Enforcing policy for tool '%s' (sync).", tool_name)
        vault.enforce(tool_name, tool_input, agent_id=agent_id)
        return original_run(*args, **kwargs)

    @functools.wraps(original_arun)
    async def guarded_arun(*args: Any, **kwargs: Any) -> Any:
        tool_input = _build_tool_args(args, kwargs)
        logger.debug("Enforcing policy for tool '%s' (async).", tool_name)
        vault.enforce(tool_name, tool_input, agent_id=agent_id)
        return await original_arun(*args, **kwargs)

    # Monkey-patch the copies.
    wrapped_tool._run = guarded_run
    wrapped_tool._arun = guarded_arun

    return wrapped_tool


def _build_tool_args(args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
    """Merge positional and keyword arguments into a dict for policy evaluation."""
    tool_args: dict[str, Any] = {}
    if kwargs:
        tool_args.update(kwargs)
    if args:
        # LangChain commonly passes a single positional string argument.
        if len(args) == 1:
            tool_args = _normalize_tool_input(args[0])
            tool_args.update(kwargs)
        else:
            tool_args["_positional"] = list(args)
    return tool_args
