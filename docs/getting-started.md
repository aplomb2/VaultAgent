# Getting Started with VaultAgent

VaultAgent is an open-source permission control layer for AI agents. It lets you define fine-grained policies that govern which tools your agents can call, with what arguments, and how often -- then enforces those policies at runtime and logs every decision for audit.

Think of it as **IAM for AI Agents**.

## Installation

```bash
pip install vaultagent
```

VaultAgent requires Python 3.10 or later. The core SDK depends only on `pyyaml` and `httpx`.

To install with middleware support for a specific LLM framework:

```bash
pip install vaultagent[openai]      # OpenAI integration
pip install vaultagent[anthropic]   # Anthropic integration
pip install vaultagent[langchain]   # LangChain integration
pip install vaultagent[all]         # All integrations
```

## Create Your First Policy

VaultAgent policies are written in YAML. Generate a starter file with the CLI:

```bash
vaultagent init
```

This creates a `vaultagent.policy.yaml` file in the current directory. Here is a minimal policy to start with:

```yaml
version: "1.0"

defaults:
  action: deny        # Block anything not explicitly allowed
  log_level: all      # Log every decision

agents:
  my-agent:
    description: "Demo agent with limited permissions"
    tools:
      - tool: "database.query"
        action: allow
        constraints:
          operations: ["SELECT"]
          tables: ["products", "orders"]

      - tool: "email.send"
        action: require_approval

      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 30
      max_calls_per_hour: 500
```

This policy:

1. Allows `my-agent` to run `database.query`, but only `SELECT` statements on the `products` and `orders` tables.
2. Requires human approval before `email.send` can execute.
3. Denies all other tools.
4. Caps the agent at 30 calls per minute and 500 per hour.

## Basic Usage with OpenAI

```python
from openai import OpenAI
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_openai

# 1. Load your policy
vault = VaultAgent(
    policy="vaultagent.policy.yaml",
    agent_id="my-agent",
)

# 2. Wrap the OpenAI client
client = wrap_openai(OpenAI(), vault)

# 3. Use the client as usual -- tool calls are now policy-checked
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Look up order #1234"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "database.query",
            "description": "Run a SQL query",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string"}
                },
                "required": ["sql"]
            }
        }
    }],
)
```

If the model returns a tool call that violates the policy, VaultAgent raises a `PermissionDeniedError` before the tool is executed.

## Protecting Tools Directly

You can also protect individual functions without an LLM middleware wrapper:

```python
from vaultagent import VaultAgent

vault = VaultAgent(policy="vaultagent.policy.yaml", agent_id="my-agent")

@vault.protect()
def database_query(sql: str):
    return db.execute(sql)

@vault.protect()
def send_email(to: str, subject: str, body: str):
    return email_client.send(to, subject, body)
```

Or check permissions imperatively:

```python
result = vault.check("database.query", {"sql": "SELECT * FROM orders"})
if result.allowed:
    # proceed
    ...
```

## Validate Your Policy with the CLI

Before deploying, validate the policy file for syntax errors and structural issues:

```bash
vaultagent validate vaultagent.policy.yaml
```

Run the built-in test suite that exercises every rule in your policy:

```bash
vaultagent test vaultagent.policy.yaml
```

View audit logs:

```bash
vaultagent logs vaultagent-audit.jsonl
vaultagent logs vaultagent-audit.jsonl --limit 20
```

## Next Steps

- [SDK Reference](sdk-reference.md) -- Full API documentation for all classes and methods.
- [Policy Reference](policy-reference.md) -- Complete specification of the YAML policy format.
- [Dashboard Guide](dashboard-guide.md) -- Setting up and using the web dashboard.
- **Integrations:**
  - [OpenAI](integrations/openai.md)
  - [Anthropic](integrations/anthropic.md)
  - [LangChain](integrations/langchain.md)
  - [MCP Proxy](integrations/mcp.md)
