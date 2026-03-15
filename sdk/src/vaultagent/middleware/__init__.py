"""VaultAgent middleware integrations for popular LLM frameworks.

Each integration is lazily imported so that the corresponding third-party
package (``openai``, ``anthropic``, ``langchain-core``) is only required
when the specific wrapper function is actually called.
"""

from __future__ import annotations

from vaultagent.middleware.openai import wrap_openai
from vaultagent.middleware.anthropic import wrap_anthropic
from vaultagent.middleware.langchain import wrap_langchain_tools

__all__ = [
    "wrap_openai",
    "wrap_anthropic",
    "wrap_langchain_tools",
]
