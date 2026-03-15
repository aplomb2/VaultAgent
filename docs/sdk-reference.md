# SDK Reference

This document covers every public class, method, and exception in the VaultAgent Python SDK.

## VaultAgent

The main entry point. Create an instance, then use it to check, enforce, or protect tool calls.

```python
from vaultagent import VaultAgent
```

### Constructor

```python
VaultAgent(
    policy: str | Path | Policy | None = None,
    api_key: str | None = None,
    agent_id: str | None = None,
    audit_file: str | Path | None = None,
    redact_input: bool = False,
    session_id: str | None = None,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `policy` | `str \| Path \| Policy \| None` | `None` | Path to a YAML policy file, or a `Policy` object. |
| `api_key` | `str \| None` | `None` | API key for VaultAgent Cloud. When set, audit events are reported to the cloud. |
| `agent_id` | `str \| None` | `None` | Default agent ID used for all calls unless overridden per-call. |
| `audit_file` | `str \| Path \| None` | `None` | Path to a local audit log file (JSONL format). Defaults to `vaultagent-audit.jsonl` when not using cloud mode. |
| `redact_input` | `bool` | `False` | When `True`, tool arguments are SHA-256 hashed instead of logged in plaintext. |
| `session_id` | `str \| None` | `None` | Default session identifier attached to every audit event. |

**Modes of operation:**

- **Local policy:** Pass a YAML file path or `Policy` object to `policy`. No network calls are made.
- **Cloud mode:** Pass an `api_key`. The SDK reports audit events to VaultAgent Cloud and (in future) fetches policies from the cloud.
- **Default:** When neither `policy` nor `api_key` is provided, an empty policy is used that denies everything.

### Methods

#### `check(tool_name, tool_args=None, agent_id=None) -> DecisionResult`

Check whether a tool call is allowed without executing it. Returns a `DecisionResult` object.

```python
result = vault.check("database.query", {"sql": "SELECT * FROM orders"})
if result.allowed:
    print("Allowed")
elif result.denied:
    print(f"Denied: {result.denial_reason}")
elif result.needs_approval:
    print("Needs human approval")
```

Raises `RateLimitExceededError` if the agent has exceeded its configured rate limits.

#### `enforce(tool_name, tool_args=None, agent_id=None) -> DecisionResult`

Same as `check()`, but also raises exceptions for denied and approval-required decisions. Use this when you want to stop execution on policy violations.

```python
try:
    result = vault.enforce("email.send", {"to": "user@example.com"})
except PermissionDeniedError as e:
    print(f"Blocked: {e}")
except ApprovalRequiredError as e:
    print(f"Needs approval: {e}")
except RateLimitExceededError as e:
    print(f"Rate limited: {e}")
```

#### `protect(tool_name=None, agent_id=None) -> Callable`

Decorator that wraps a function with `enforce()`. The function name is used as the tool name unless `tool_name` is specified.

```python
@vault.protect()
def send_email(to: str, subject: str, body: str):
    return email_client.send(to, subject, body)

@vault.protect(tool_name="custom.tool.name", agent_id="specific-agent")
def my_tool(**kwargs):
    ...
```

Keyword arguments passed to the decorated function are forwarded to `enforce()` as `tool_args`.

#### `flush() -> None`

Flush pending audit events to VaultAgent Cloud. Called automatically when the buffer reaches 100 events, but you can call it manually before process exit.

#### `update_policy(policy: Policy) -> None`

Replace the active policy at runtime.

```python
new_policy = Policy.from_file("updated-policy.yaml")
vault.update_policy(new_policy)
```

### Properties

#### `policy -> Policy`

Returns the current `Policy` object.

---

## Policy

Represents a complete permission policy containing agent-specific rules and defaults.

```python
from vaultagent import Policy
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | `str` | `"1.0"` | Policy format version. |
| `agents` | `dict[str, AgentPolicy]` | `{}` | Map of agent ID to `AgentPolicy`. |
| `default_action` | `Action` | `Action.DENY` | Action taken when no matching rule is found. |
| `default_log_level` | `str` | `"all"` | Log level for decisions (`"all"` logs everything). |

### Class Methods

#### `Policy.from_file(path) -> Policy`

Load a policy from a YAML file. Raises `FileNotFoundError` if the file does not exist.

```python
policy = Policy.from_file("vaultagent.policy.yaml")
```

#### `Policy.from_yaml(yaml_content: str) -> Policy`

Parse a YAML string into a `Policy` object.

```python
policy = Policy.from_yaml("""
version: "1.0"
defaults:
  action: deny
agents:
  my-agent:
    tools:
      - tool: "*"
        action: deny
""")
```

### Instance Methods

#### `get_agent_policy(agent_id: str) -> AgentPolicy | None`

Return the `AgentPolicy` for the given agent, or `None` if the agent is not defined.

#### `evaluate(agent_id: str, tool_name: str) -> tuple[Action, PolicyRule | None]`

Evaluate a tool call against the policy and return the action and matching rule. If no agent or rule is found, returns the `default_action` with `None` for the rule.

#### `to_dict() -> dict`

Serialize the policy to a dictionary (useful for API sync and debugging).

---

## PolicyRule

A single permission rule for a tool.

```python
from vaultagent import PolicyRule, Action
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `tool` | `str` | Tool name or glob pattern (e.g., `"database.*"`, `"*"`). |
| `action` | `Action` | The permission action: `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`. |
| `constraints` | `dict[str, Any]` | Optional constraint parameters (see [Policy Reference](policy-reference.md)). |

### Methods

#### `matches(tool_name: str) -> bool`

Returns `True` if this rule's `tool` pattern matches the given tool name. Uses Python's `fnmatch` for glob matching.

```python
rule = PolicyRule(tool="database.*", action=Action.ALLOW)
rule.matches("database.query")   # True
rule.matches("email.send")       # False
```

---

## Action

Enum defining the three possible permission decisions.

```python
from vaultagent import Action
```

| Value | String | Meaning |
|-------|--------|---------|
| `Action.ALLOW` | `"allow"` | Tool call is permitted. |
| `Action.DENY` | `"deny"` | Tool call is blocked. |
| `Action.REQUIRE_APPROVAL` | `"require_approval"` | Tool call is paused pending human approval. |

---

## Decision

The decision engine that evaluates tool calls against a policy, including constraint checking.

```python
from vaultagent.core.decision import Decision
```

### Constructor

```python
Decision(policy: Policy)
```

### Methods

#### `evaluate(agent_id, tool_name, tool_args=None) -> DecisionResult`

Evaluate whether a tool call should be allowed. This is the core method that:

1. Looks up the agent in the policy.
2. Finds the first matching rule.
3. If the action is `ALLOW` and the rule has constraints, checks the tool arguments against those constraints.
4. Returns a `DecisionResult`.

---

## DecisionResult

The result of a permission evaluation. Returned by `VaultAgent.check()`, `VaultAgent.enforce()`, and `Decision.evaluate()`.

```python
from vaultagent import DecisionResult
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `action` | `Action` | The decision: `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`. |
| `tool` | `str` | The tool name that was evaluated. |
| `agent_id` | `str` | The agent ID. |
| `rule` | `PolicyRule \| None` | The matching rule, or `None` if no rule matched. |
| `constraints_applied` | `list[str]` | Human-readable list of constraints that were checked. |
| `denial_reason` | `str \| None` | Explanation of why the call was denied, if applicable. |
| `timestamp` | `datetime` | UTC timestamp of the evaluation. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `allowed` | `bool` | `True` if the action is `ALLOW`. |
| `denied` | `bool` | `True` if the action is `DENY`. |
| `needs_approval` | `bool` | `True` if the action is `REQUIRE_APPROVAL`. |

---

## AuditEvent

A single audit log entry that records a tool call decision.

```python
from vaultagent import AuditEvent
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `str` | ISO-8601 timestamp. |
| `agent_id` | `str` | The agent that made the call. |
| `tool` | `str` | The tool that was called. |
| `action` | `str` | The decision (`"allow"`, `"deny"`, `"require_approval"`). |
| `session_id` | `str \| None` | Optional session identifier. |
| `input_args` | `dict \| None` | Tool arguments (omitted when `redact_input=True`). |
| `input_hash` | `str \| None` | SHA-256 hash of the arguments (present when `redact_input=True`). |
| `output_hash` | `str \| None` | SHA-256 hash of the tool output (reserved for future use). |
| `constraints_applied` | `list[str]` | List of constraints that were evaluated. |
| `denial_reason` | `str \| None` | Reason for denial, if applicable. |
| `latency_ms` | `int \| None` | Time taken for the policy evaluation in milliseconds. |
| `metadata` | `dict` | Additional metadata (reserved for extensions). |

### Methods

#### `to_dict() -> dict`

Serialize to a dictionary, omitting `None` values.

#### `to_json() -> str`

Serialize to a JSON string.

#### `AuditEvent.from_decision(result, session_id=None, input_args=None, latency_ms=None, redact_input=False) -> AuditEvent`

Class method. Create an `AuditEvent` from a `DecisionResult`.

---

## AuditLogger

Manages audit log output to local files and VaultAgent Cloud.

```python
from vaultagent import AuditLogger
```

### Constructor

```python
AuditLogger(
    file_path: str | Path | None = None,
    cloud_reporter: Any | None = None,
    redact_input: bool = False,
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_path` | `str \| Path \| None` | Path to the local JSONL audit log file. |
| `cloud_reporter` | `Any \| None` | A `CloudReporter` instance for sending events to VaultAgent Cloud. |
| `redact_input` | `bool` | When `True`, tool arguments are hashed instead of stored in plaintext. |

### Methods

#### `log(result, session_id=None, input_args=None, latency_ms=None) -> AuditEvent`

Log a `DecisionResult`. Writes to the local file immediately and buffers for cloud reporting. Returns the created `AuditEvent`.

#### `flush() -> None`

Send all buffered events to VaultAgent Cloud. Called automatically every 100 events.

---

## Exceptions

All exceptions inherit from `VaultAgentError`.

### VaultAgentError

```python
from vaultagent.core.vault import VaultAgentError
```

Base exception class.

### PermissionDeniedError

```python
from vaultagent.core.vault import PermissionDeniedError
```

Raised when a tool call is denied by policy.

| Attribute | Type | Description |
|-----------|------|-------------|
| `result` | `DecisionResult` | The full decision result. |

```python
try:
    vault.enforce("dangerous_tool", {})
except PermissionDeniedError as e:
    print(e)               # Human-readable message
    print(e.result.tool)   # "dangerous_tool"
    print(e.result.denial_reason)
```

### ApprovalRequiredError

```python
from vaultagent.core.vault import ApprovalRequiredError
```

Raised when a tool call requires human approval before execution.

| Attribute | Type | Description |
|-----------|------|-------------|
| `result` | `DecisionResult` | The full decision result. |

### RateLimitExceededError

```python
from vaultagent.core.vault import RateLimitExceededError
```

Raised when the agent has exceeded its configured rate limits.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agent_id` | `str` | The agent that was rate-limited. |
| `limit_type` | `str` | Which limit was exceeded (`"minute"`, `"hour"`, or `"day"`). |
| `retry_after` | `float \| None` | Seconds until the rate limit window resets. |

---

## Configuration Options Summary

| Option | Where Set | Purpose |
|--------|-----------|---------|
| `policy` | `VaultAgent()` | YAML file path or `Policy` object. |
| `api_key` | `VaultAgent()` | Enables cloud mode (audit reporting, remote policy). |
| `agent_id` | `VaultAgent()` or per-call | Identifies the agent for policy lookup. |
| `audit_file` | `VaultAgent()` | Custom path for local JSONL audit log. |
| `redact_input` | `VaultAgent()` | Hash tool arguments instead of logging plaintext. |
| `session_id` | `VaultAgent()` | Session identifier for correlating related events. |
| `on_denied` | Middleware wrappers | `"raise"` (default) or `"drop"` -- controls behavior on denied tool calls. |
