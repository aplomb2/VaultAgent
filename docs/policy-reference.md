# Policy Reference

VaultAgent policies are YAML files that define what each agent is allowed to do. This document covers every field, option, and pattern available in the policy format.

## File Structure

```yaml
version: "1.0"

defaults:
  action: deny
  log_level: all

agents:
  agent-id:
    description: "Human-readable description"
    tools:
      - tool: "tool.name"
        action: allow
        constraints:
          # ...
    rate_limits:
      max_calls_per_minute: 30
```

## Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | string | No | `"1.0"` | Policy format version. Currently only `"1.0"` is supported. |
| `defaults` | object | No | See below | Default behavior when no rule matches. |
| `agents` | object | Yes | -- | Map of agent IDs to their permission configuration. |

## Defaults

The `defaults` section controls behavior when no matching rule is found for a tool call.

```yaml
defaults:
  action: deny       # deny | allow | require_approval
  log_level: all     # all | denied_only | none
```

| Field | Values | Default | Description |
|-------|--------|---------|-------------|
| `action` | `deny`, `allow`, `require_approval` | `deny` | Action taken when no agent or rule matches. **Best practice:** always set this to `deny`. |
| `log_level` | `all`, `denied_only`, `none` | `all` | Controls which decisions are written to the audit log. |

## Agents

Each key under `agents` is an agent identifier. This ID must match the `agent_id` passed at runtime to `VaultAgent()` or to individual `check()`/`enforce()` calls.

```yaml
agents:
  my-agent-id:
    description: "Optional human-readable description"
    tools:
      # ... rules ...
    rate_limits:
      # ... limits ...
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | Human-readable description shown in CLI output and dashboard. |
| `tools` | list | Yes | Ordered list of permission rules. |
| `rate_limits` | object | No | Rate limiting configuration for this agent. |

## Tool Rules

Rules are evaluated **top to bottom**. The first rule whose `tool` pattern matches the tool name determines the outcome. If no rule matches, the `defaults.action` is used.

```yaml
tools:
  - tool: "database.query"
    action: allow
    constraints:
      operations: ["SELECT"]
      tables: ["users", "orders"]

  - tool: "email.*"
    action: require_approval

  - tool: "*"
    action: deny
```

### Rule Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool` | string | Yes | Tool name or glob pattern to match against. |
| `action` | string | Yes | One of `allow`, `deny`, or `require_approval`. |
| `constraints` | object | No | Additional restrictions applied when the action is `allow`. |

## Action Types

### `allow`

The tool call is permitted. If `constraints` are defined, the call is allowed only if all constraints pass. A constraint violation converts the decision to `deny`.

### `deny`

The tool call is blocked. VaultAgent raises a `PermissionDeniedError` (when using `enforce()` or middleware wrappers) or returns a `DecisionResult` with `action=DENY` (when using `check()`).

### `require_approval`

The tool call is paused and requires human approval before proceeding. VaultAgent raises an `ApprovalRequiredError`. In cloud mode, the approval request is sent to the dashboard for review.

## Glob Pattern Matching

The `tool` field supports glob patterns using Python's `fnmatch` syntax:

| Pattern | Matches | Does Not Match |
|---------|---------|----------------|
| `database.query` | `database.query` | `database.write` |
| `database.*` | `database.query`, `database.write` | `email.send` |
| `*.read` | `file.read`, `database.read` | `file.write` |
| `*` | Everything | -- |
| `file.read_?` | `file.read_1`, `file.read_a` | `file.read_10` |

Rules are matched in order, so place more specific rules before catch-all patterns:

```yaml
tools:
  - tool: "database.query"       # Specific: checked first
    action: allow
  - tool: "database.*"           # Broader: checked second
    action: deny
  - tool: "*"                    # Catch-all: checked last
    action: deny
```

## Constraint Types

Constraints are checked only when the rule's action is `allow`. If a constraint check fails, the decision is converted to `deny`.

### `tables`

Restricts which database tables can be referenced in SQL queries. VaultAgent extracts table names from `FROM`, `JOIN`, `INTO`, and `UPDATE` clauses.

```yaml
constraints:
  tables: ["users", "orders", "products"]
```

The constraint looks for a `sql` or `query` field in the tool arguments. Set to `["*"]` to allow all tables (effectively disabling this constraint).

### `operations`

Restricts which SQL operations are allowed. VaultAgent checks the first keyword in the SQL statement.

```yaml
constraints:
  operations: ["SELECT"]               # Read only
  operations: ["SELECT", "INSERT"]     # Read and insert
```

The constraint looks for a `sql` or `query` field in the tool arguments.

### `paths`

Restricts which file paths the tool can access. Supports glob patterns.

```yaml
constraints:
  paths:
    - "./src/*"
    - "./tests/*"
    - "/tmp/reports/*"
```

The constraint looks for a `path` or `file_path` field in the tool arguments. Each path in the arguments is matched against all allowed patterns using `fnmatch`.

### `domains`

Restricts which email domains or URL domains the tool can target. Supports glob patterns.

```yaml
constraints:
  domains:
    - "company.com"
    - "*.company.com"
```

The constraint checks `to`, `url`, `domain`, and `email` fields in the tool arguments. For email addresses, the domain is extracted from after the `@` sign. For URLs, the hostname is extracted.

### `max_rows`

Limits the number of rows a query can return.

```yaml
constraints:
  max_rows: 1000
```

The constraint checks `limit` or `max_rows` fields in the tool arguments. If the requested limit exceeds the policy maximum, the call is denied.

### Combining Constraints

Multiple constraints can be combined in a single rule. All constraints must pass for the call to be allowed:

```yaml
- tool: "database.query"
  action: allow
  constraints:
    tables: ["analytics", "reports"]
    operations: ["SELECT"]
    max_rows: 10000
```

## Rate Limiting

Rate limits are set per agent and apply across all tool calls.

```yaml
rate_limits:
  max_calls_per_minute: 30
  max_calls_per_hour: 500
  max_calls_per_day: 5000
```

| Field | Type | Description |
|-------|------|-------------|
| `max_calls_per_minute` | integer | Maximum tool calls in a sliding 60-second window. |
| `max_calls_per_hour` | integer | Maximum tool calls in a sliding 3600-second window. |
| `max_calls_per_day` | integer | Maximum tool calls in a sliding 86400-second window. |

All fields are optional. Omitting a field disables that limit tier. Rate limits are enforced using a sliding window algorithm and are thread-safe.

When a rate limit is exceeded, VaultAgent raises a `RateLimitExceededError` with the `limit_type` (`"minute"`, `"hour"`, or `"day"`) and a `retry_after` value in seconds.

## Complete Example

```yaml
version: "1.0"

defaults:
  action: deny
  log_level: all

agents:
  # A coding assistant with file access and terminal usage
  coding-assistant:
    description: "AI coding assistant with scoped file and terminal access"
    tools:
      - tool: read_file
        action: allow
        constraints:
          paths:
            - "./src/*"
            - "./tests/*"
            - "./docs/*"

      - tool: write_file
        action: allow
        constraints:
          paths:
            - "./src/*"
            - "./tests/*"

      - tool: run_command
        action: require_approval

      - tool: delete_file
        action: deny

      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 30
      max_calls_per_hour: 500

  # A data analysis agent with read-only database access
  data-analyst:
    description: "Agent that queries databases for analytics"
    tools:
      - tool: "database.query"
        action: allow
        constraints:
          tables:
            - analytics
            - reports
            - public_metrics
          operations:
            - SELECT
          max_rows: 10000

      - tool: "database.write"
        action: deny

      - tool: "file.write"
        action: allow
        constraints:
          paths:
            - "/tmp/reports/*"

      - tool: "file.read"
        action: allow
        constraints:
          paths:
            - "/data/*"
            - "/tmp/reports/*"

      - tool: send_email
        action: allow
        constraints:
          domains:
            - "company.com"

      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 10
      max_calls_per_hour: 200

  # A customer support bot
  support-bot:
    description: "Customer support agent with read-only data access"
    tools:
      - tool: "database.query"
        action: allow
        constraints:
          tables: ["customers", "orders", "tickets"]
          operations: ["SELECT"]

      - tool: "ticket.create"
        action: allow

      - tool: "ticket.update"
        action: allow

      - tool: "email.send"
        action: require_approval

      - tool: "slack.send"
        action: allow
        constraints:
          domains: ["*.company.com"]

      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 30
      max_calls_per_hour: 500
```

## Best Practices

1. **Default to deny.** Always set `defaults.action: deny`. Explicitly allow only what each agent needs.

2. **End with a catch-all rule.** Place `- tool: "*"` with `action: deny` at the end of every agent's rule list. This makes the deny-by-default behavior explicit and visible.

3. **Use specific tool names first.** Rules are matched top to bottom. Place specific names before glob patterns to ensure precise control.

4. **Constrain `allow` rules.** When allowing a tool, add constraints to limit what it can do. An unconstrained `allow` on a database tool gives the agent full access.

5. **Set rate limits.** Even trusted agents should have rate limits to prevent runaway loops and excessive API usage.

6. **Use `require_approval` for sensitive operations.** Tools that send emails, modify production data, or perform destructive actions should require human review.

7. **Validate before deploying.** Run `vaultagent validate` and `vaultagent test` against your policy file before deploying it to production.

8. **Enable audit logging.** Keep `log_level: all` in production. The audit log is essential for incident response and compliance.

9. **Separate agents by role.** Define distinct agent IDs for different roles (e.g., `coding-assistant` vs `data-analyst`) rather than sharing a single agent ID.

10. **Review policies regularly.** As your agents gain new tools, update the policy to explicitly handle them rather than relying on catch-all rules.
