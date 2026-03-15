# Anthropic Integration

VaultAgent integrates with the Anthropic Python SDK by wrapping the client so that every `tool_use` content block in a messages response is validated against your policy.

## Installation

```bash
pip install vaultagent[anthropic]
```

## Usage

```python
from anthropic import Anthropic
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_anthropic

vault = VaultAgent(policy="vaultagent.policy.yaml", agent_id="my-agent")
client = wrap_anthropic(Anthropic(), vault)
```

The wrapped client has the same interface as the original `Anthropic` client. You continue to call `client.messages.create(...)` exactly as before.

### Function Signature

```python
wrap_anthropic(
    client: anthropic.Anthropic | anthropic.AsyncAnthropic,
    vault: VaultAgent,
    *,
    agent_id: str | None = None,
    on_denied: str = "raise",
) -> anthropic.Anthropic | anthropic.AsyncAnthropic
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic \| AsyncAnthropic` | -- | The Anthropic client instance to wrap. |
| `vault` | `VaultAgent` | -- | The VaultAgent instance with the active policy. |
| `agent_id` | `str \| None` | `None` | Agent ID for policy lookup. Overrides the default set on `vault`. |
| `on_denied` | `str` | `"raise"` | Behavior when a tool use is denied: `"raise"` throws an exception, `"drop"` silently removes the denied block from the response content. |

## How It Works

1. Your application calls `client.messages.create(...)` with `tools` defined.
2. The request is forwarded to the Anthropic API without modification.
3. When Anthropic returns a response, VaultAgent inspects the `content` list for `tool_use` blocks.
4. For each `tool_use` block, VaultAgent:
   - Extracts the `name` and `input` fields.
   - Calls `vault.enforce(name, input, agent_id=agent_id)`.
   - If the policy allows the call, the block is kept.
   - If the policy denies the call, the behavior depends on `on_denied`.
5. The (potentially filtered) response is returned to your application.

### Anthropic Response Structure

Anthropic messages contain a `content` list where each element is either a `TextBlock` or a `ToolUseBlock`:

```python
# ToolUseBlock attributes:
#   .type = "tool_use"
#   .id   = "toolu_abc123"
#   .name = "database.query"
#   .input = {"sql": "SELECT * FROM users"}
```

VaultAgent only inspects blocks with `type == "tool_use"`. Text blocks are always passed through unchanged.

### `on_denied="raise"` (default)

The first denied `tool_use` block raises a `PermissionDeniedError`, `ApprovalRequiredError`, or `RateLimitExceededError`.

### `on_denied="drop"`

Denied `tool_use` blocks are silently removed from `response.content`. Text blocks are always preserved.

## Error Handling

```python
from vaultagent.core.vault import (
    PermissionDeniedError,
    ApprovalRequiredError,
    RateLimitExceededError,
)

try:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=messages,
        tools=tools,
    )
except PermissionDeniedError as e:
    print(f"Tool use blocked: {e}")
    print(f"Tool: {e.result.tool}")
    print(f"Reason: {e.result.denial_reason}")
except ApprovalRequiredError as e:
    print(f"Needs approval: {e.result.tool}")
except RateLimitExceededError as e:
    print(f"Rate limited: retry after {e.retry_after}s")
```

## Full Example

```python
from anthropic import Anthropic
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_anthropic
from vaultagent.core.vault import PermissionDeniedError

# Load policy
vault = VaultAgent(
    policy="vaultagent.policy.yaml",
    agent_id="support-bot",
    audit_file="audit.jsonl",
)

# Wrap the client
client = wrap_anthropic(Anthropic(), vault)

# Define tools
tools = [
    {
        "name": "database.query",
        "description": "Query the customer database",
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "SQL query to execute"
                }
            },
            "required": ["sql"]
        }
    },
    {
        "name": "ticket.create",
        "description": "Create a support ticket",
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {"type": "string"},
                "description": {"type": "string"},
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high"]
                }
            },
            "required": ["subject", "description"]
        }
    }
]

messages = [
    {"role": "user", "content": "Look up customer order #5678 and create a ticket for the refund"}
]

try:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=messages,
        tools=tools,
    )

    # Process the response content
    for block in response.content:
        if block.type == "text":
            print(f"Text: {block.text}")
        elif block.type == "tool_use":
            print(f"Approved tool use: {block.name}")
            print(f"Input: {block.input}")
            # Now safe to execute the tool
except PermissionDeniedError as e:
    print(f"Blocked by policy: {e}")
```

## Async Support

`wrap_anthropic` automatically detects `AsyncAnthropic` and returns an async-compatible proxy:

```python
from anthropic import AsyncAnthropic
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_anthropic

vault = VaultAgent(policy="vaultagent.policy.yaml", agent_id="my-agent")
client = wrap_anthropic(AsyncAnthropic(), vault)

async def main():
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello"}],
        tools=tools,
    )
```

## See Also

- [SDK Reference](../sdk-reference.md) -- Full API documentation.
- [Policy Reference](../policy-reference.md) -- How to write policies.
- [OpenAI Integration](openai.md) -- Similar integration for OpenAI.
- [LangChain Integration](langchain.md) -- Integration for LangChain tools.
