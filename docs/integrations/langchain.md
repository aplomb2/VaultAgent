# LangChain Integration

VaultAgent integrates with LangChain by wrapping tool objects so that `vault.enforce()` is called before every tool invocation. Both synchronous (`_run`) and asynchronous (`_arun`) execution paths are protected.

## Installation

```bash
pip install vaultagent[langchain]
```

This installs `langchain-core` as a dependency. You will also need your LLM provider's LangChain package (e.g., `langchain-openai`, `langchain-anthropic`).

## Usage

```python
from vaultagent import VaultAgent
from vaultagent.middleware import wrap_langchain_tools

vault = VaultAgent(policy="vaultagent.policy.yaml", agent_id="my-agent")

# Your existing LangChain tools
tools = [search_tool, email_tool, database_tool]

# Wrap them with VaultAgent policy enforcement
protected_tools = wrap_langchain_tools(tools, vault)
```

### Function Signature

```python
wrap_langchain_tools(
    tools: list[BaseTool],
    vault: VaultAgent,
    *,
    agent_id: str | None = None,
) -> list[BaseTool]
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tools` | `list[BaseTool]` | -- | List of LangChain `BaseTool` instances. |
| `vault` | `VaultAgent` | -- | The VaultAgent instance with the active policy. |
| `agent_id` | `str \| None` | `None` | Agent ID for policy lookup. Overrides the default set on `vault`. |

**Returns:** A new list of wrapped tools with the same length and order. The original tool objects are not modified; shallow copies are created.

## How It Works

1. `wrap_langchain_tools` creates a shallow copy of each tool.
2. The `_run` and `_arun` methods on each copy are replaced with guarded versions.
3. When a guarded tool is invoked:
   - The tool arguments are extracted from the positional and keyword arguments.
   - `vault.enforce(tool.name, tool_args, agent_id=agent_id)` is called.
   - If the policy allows the call, the original `_run` or `_arun` method executes normally.
   - If the policy denies the call, a `PermissionDeniedError`, `ApprovalRequiredError`, or `RateLimitExceededError` is raised before the tool executes.

### Argument Normalization

LangChain tools receive input in various forms. VaultAgent normalizes them:

- **Dict input:** Passed through as-is.
- **String input:** Wrapped as `{"input": "<the string>"}`.
- **Keyword arguments:** Merged into a dict.
- **Single positional argument:** Normalized via the rules above, then merged with any keyword arguments.

## Error Handling

VaultAgent exceptions propagate through the LangChain agent execution loop. You can catch them in your agent executor:

```python
from vaultagent.core.vault import (
    PermissionDeniedError,
    ApprovalRequiredError,
    RateLimitExceededError,
)

try:
    result = agent_executor.invoke({"input": "Delete all user data"})
except PermissionDeniedError as e:
    print(f"Tool blocked: {e.result.tool} -- {e.result.denial_reason}")
except ApprovalRequiredError as e:
    print(f"Needs approval: {e.result.tool}")
except RateLimitExceededError as e:
    print(f"Rate limited: {e.limit_type}, retry after {e.retry_after}s")
```

## Full Example

```python
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate

from vaultagent import VaultAgent
from vaultagent.middleware import wrap_langchain_tools
from vaultagent.core.vault import PermissionDeniedError

# Define custom tools
@tool
def database_query(sql: str) -> str:
    """Execute a SQL query against the analytics database."""
    # Your database logic here
    return f"Results for: {sql}"

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a recipient."""
    # Your email logic here
    return f"Email sent to {to}"

@tool
def read_file(path: str) -> str:
    """Read the contents of a file."""
    # Your file reading logic here
    return f"Contents of {path}"

# Load VaultAgent policy
vault = VaultAgent(
    policy="vaultagent.policy.yaml",
    agent_id="data-analyst",
    audit_file="audit.jsonl",
)

# Wrap tools with policy enforcement
raw_tools = [database_query, send_email, read_file]
protected_tools = wrap_langchain_tools(raw_tools, vault)

# Build the agent with protected tools
llm = ChatOpenAI(model="gpt-4o")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful data analyst."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, protected_tools, prompt)
executor = AgentExecutor(agent=agent, tools=protected_tools, verbose=True)

# Run the agent
try:
    result = executor.invoke({
        "input": "Query the analytics table for top products and email the report to team@company.com"
    })
    print(result["output"])
except PermissionDeniedError as e:
    print(f"Blocked: {e}")
```

### Policy for This Example

```yaml
version: "1.0"

defaults:
  action: deny

agents:
  data-analyst:
    description: "Data analysis agent"
    tools:
      - tool: "database_query"
        action: allow
        constraints:
          operations: ["SELECT"]
          tables: ["analytics", "products"]

      - tool: "send_email"
        action: allow
        constraints:
          domains: ["company.com"]

      - tool: "read_file"
        action: allow
        constraints:
          paths: ["/data/*", "/tmp/reports/*"]

      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 20
```

## Notes

- The wrapped tools maintain the same `name`, `description`, and schema as the originals. LangChain and LLMs see no difference.
- Tool names used in the policy must match the LangChain tool's `.name` attribute. For tools created with the `@tool` decorator, this is the function name by default.
- Unlike the OpenAI and Anthropic middleware (which intercept at the response level), the LangChain middleware intercepts at the tool execution level, before the tool function runs.

## See Also

- [SDK Reference](../sdk-reference.md) -- Full API documentation.
- [Policy Reference](../policy-reference.md) -- How to write policies.
- [OpenAI Integration](openai.md) -- Direct OpenAI SDK integration.
- [Anthropic Integration](anthropic.md) -- Direct Anthropic SDK integration.
