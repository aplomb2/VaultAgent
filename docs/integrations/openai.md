# OpenAI Integration

VaultAgent integrates with the OpenAI Python SDK by wrapping the client so that every tool call in a chat completion response is validated against your policy before it reaches your application code.

## Installation

```bash
pip install vaultagent[openai]
```

## Usage

```python
from openai import OpenAI
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_openai

vault = VaultAgent(policy="vaultagent.policy.yaml", agent_id="my-agent")
client = wrap_openai(OpenAI(), vault)
```

The wrapped client has the same interface as the original `OpenAI` client. You continue to call `client.chat.completions.create(...)` exactly as before.

### Function Signature

```python
wrap_openai(
    client: openai.OpenAI | openai.AsyncOpenAI,
    vault: VaultAgent,
    *,
    agent_id: str | None = None,
    on_denied: str = "raise",
) -> openai.OpenAI | openai.AsyncOpenAI
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI \| AsyncOpenAI` | -- | The OpenAI client instance to wrap. |
| `vault` | `VaultAgent` | -- | The VaultAgent instance with the active policy. |
| `agent_id` | `str \| None` | `None` | Agent ID for policy lookup. Overrides the default set on `vault`. |
| `on_denied` | `str` | `"raise"` | Behavior when a tool call is denied: `"raise"` throws an exception, `"drop"` silently removes the denied tool call from the response. |

## How It Works

1. Your application calls `client.chat.completions.create(...)` with `tools` defined.
2. The request is forwarded to the OpenAI API as-is. VaultAgent does not modify outgoing requests.
3. When OpenAI returns a response containing `tool_calls` in the assistant message, VaultAgent intercepts each tool call.
4. For each tool call, VaultAgent:
   - Extracts the function name and parses the JSON arguments.
   - Calls `vault.enforce(tool_name, tool_args, agent_id=agent_id)`.
   - If the policy allows the call, it is kept in the response.
   - If the policy denies the call, the behavior depends on `on_denied`.
5. The (potentially filtered) response is returned to your application.

### `on_denied="raise"` (default)

The first denied tool call raises a `PermissionDeniedError`, `ApprovalRequiredError`, or `RateLimitExceededError`. Your application should catch these exceptions.

### `on_denied="drop"`

Denied tool calls are silently removed from the `message.tool_calls` list. If all tool calls are removed, `message.tool_calls` is set to `None`.

## Error Handling

```python
from vaultagent.core.vault import (
    PermissionDeniedError,
    ApprovalRequiredError,
    RateLimitExceededError,
)

try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tools,
    )
except PermissionDeniedError as e:
    print(f"Tool call blocked: {e}")
    print(f"Tool: {e.result.tool}")
    print(f"Reason: {e.result.denial_reason}")
except ApprovalRequiredError as e:
    print(f"Tool call needs approval: {e.result.tool}")
except RateLimitExceededError as e:
    print(f"Rate limit exceeded: {e.limit_type}")
    print(f"Retry after: {e.retry_after}s")
```

## Full Example

```python
from openai import OpenAI
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_openai
from vaultagent.core.vault import PermissionDeniedError

# Define the policy inline or load from file
vault = VaultAgent(
    policy="vaultagent.policy.yaml",
    agent_id="data-analyst",
    audit_file="audit.jsonl",
)

# Wrap the client
client = wrap_openai(OpenAI(), vault)

# Define tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "database.query",
            "description": "Execute a SQL query against the analytics database",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "The SQL query to execute"
                    }
                },
                "required": ["sql"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"}
                },
                "required": ["to", "subject", "body"]
            }
        }
    }
]

messages = [
    {"role": "user", "content": "Show me the top 10 customers by revenue"}
]

try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tools,
    )

    # If the model returned tool calls, they have already been policy-checked
    for choice in response.choices:
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                print(f"Approved tool call: {tc.function.name}")
                print(f"Arguments: {tc.function.arguments}")
                # Now safe to execute the tool call
except PermissionDeniedError as e:
    print(f"Blocked by policy: {e}")
```

## Async Support

`wrap_openai` automatically detects whether you pass an `AsyncOpenAI` client and returns an async-compatible proxy:

```python
from openai import AsyncOpenAI
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_openai

vault = VaultAgent(policy="vaultagent.policy.yaml", agent_id="my-agent")
client = wrap_openai(AsyncOpenAI(), vault)

async def main():
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
        tools=tools,
    )
```

## See Also

- [SDK Reference](../sdk-reference.md) -- Full API documentation.
- [Policy Reference](../policy-reference.md) -- How to write policies.
- [Anthropic Integration](anthropic.md) -- Similar integration for Anthropic.
- [LangChain Integration](langchain.md) -- Integration for LangChain tools.
