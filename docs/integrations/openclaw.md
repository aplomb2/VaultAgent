# OpenClaw Integration

VaultAgent adds **runtime permission enforcement**, **audit logging**, and **human approval workflows** to [OpenClaw](https://github.com/openclawai/openclaw) — the most popular open-source AI agent framework.

## Why OpenClaw Needs VaultAgent

OpenClaw gives AI agents powerful capabilities: file system access, shell execution, browser automation, and a marketplace of community-built skills. That power comes with risk:

- **135K+ exposed instances** discovered in public security scans ([CrowdStrike 2025 Threat Report](https://www.crowdstrike.com))
- **12% of the skill marketplace** flagged for unsafe patterns ([Cisco Talos research](https://talosintelligence.com))
- No built-in mechanism to restrict which tools an agent can call, or to require human approval for sensitive operations

### VaultAgent vs SecureClaw

SecureClaw (by Adversa AI) offers audit checks and behavioral rules at the prompt level. VaultAgent takes a different approach:

| Capability | VaultAgent | SecureClaw |
|---|---|---|
| **Enforcement layer** | Code-level (MCP proxy intercepts tool calls) | Prompt-level (behavioral rules) |
| **Bypassable?** | No — tool calls are blocked before execution | Yes — prompt injection can bypass rules |
| **Real-time dashboard** | Yes — live monitoring, charts, alerts | No |
| **Human approval workflow** | Yes — `require_approval` pauses for review | No |
| **Audit logging** | Structured JSONL + cloud API | Log file |
| **Policy format** | YAML with glob matching + constraints | JSON behavioral rules |
| **MCP native** | Yes — runs as MCP proxy server | No |

## Architecture

```
OpenClaw Agent
    │
    │ tool call (via MCP)
    ▼
┌────────────────────────────┐
│   VaultAgent MCP Proxy     │
│                            │
│  1. Match tool against     │
│     policy rules           │
│  2. Check constraints      │
│  3. Decision:              │
│     ✅ allow → forward     │
│     ❌ deny  → block       │
│     ⏳ approval → pause    │
│  4. Log audit event        │
└────────────────────────────┘
    │
    ▼
Upstream MCP Server (filesystem, GitHub, etc.)
```

The MCP proxy sits between OpenClaw and any upstream MCP server. OpenClaw sees the same tools, but every call goes through VaultAgent policy enforcement. No changes to OpenClaw code are required.

## Quick Start

### Prerequisites

- Node.js 18+
- OpenClaw installed and running
- VaultAgent MCP proxy built (`cd mcp-server && npm install && npm run build`)

### Step 1: Create a Policy

Create `vaultagent.policy.yaml` with rules for the tools your MCP server exposes:

```yaml
version: 1
defaultDecision: deny

rules:
  # Allow read operations
  - pattern: "fs_read"
    decision: allow
  - pattern: "fs_search"
    decision: allow
  - pattern: "fs_list"
    decision: allow

  # Allow writes only under ./src/
  - pattern: "fs_write"
    decision: allow
    argConstraints:
      path: "^\\./src/.*"
  - pattern: "fs_write"
    decision: deny

  # Shell commands require human approval
  - pattern: "bash"
    decision: require_approval
  - pattern: "exec_command"
    decision: require_approval

  # Browser navigation is safe; typing requires approval
  - pattern: "browser_navigate"
    decision: allow
  - pattern: "browser_click"
    decision: allow
  - pattern: "browser_type"
    decision: require_approval

  # Deny everything else
  - pattern: "*"
    decision: deny
```

### Step 2: Configure OpenClaw

Add the VaultAgent MCP proxy to your `openclaw.json`:

```json
{
  "mcpServers": {
    "filesystem-protected": {
      "command": "node",
      "args": [
        "/path/to/VaultAgent/mcp-server/dist/index.js",
        "--policy", "/path/to/vaultagent.policy.yaml",
        "--agent-id", "openclaw",
        "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/home/user/workspace"
      ]
    }
  }
}
```

Replace `/path/to/VaultAgent` and `/path/to/vaultagent.policy.yaml` with the actual paths on your system.

**How this works:** OpenClaw launches the VaultAgent MCP proxy as a standard MCP server. The proxy in turn spawns the upstream MCP server (everything after `--`) and forwards tool calls through policy enforcement.

### Step 3: Verify

Start OpenClaw. When the agent calls a tool:

- **Allowed tools** execute normally — the agent won't notice any difference.
- **Denied tools** return an error: `[VaultAgent] Tool call denied by policy`.
- **Approval-required tools** return a message explaining the call is paused for review.

Audit events are written to `vaultagent-mcp-audit.jsonl` in the working directory.

## Connect to the Dashboard

To see audit events in the VaultAgent Dashboard, add cloud reporting flags:

```json
{
  "mcpServers": {
    "filesystem-protected": {
      "command": "node",
      "args": [
        "/path/to/VaultAgent/mcp-server/dist/index.js",
        "--policy", "/path/to/vaultagent.policy.yaml",
        "--agent-id", "openclaw",
        "--cloud-endpoint", "https://your-dashboard.com/api/v1/ingest",
        "--cloud-api-key", "va_sk_xxx",
        "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/home/user/workspace"
      ]
    }
  }
}
```

Events are buffered and sent in batches (50 events or every 10 seconds).

## Docker Deployment

A `docker-compose.yml` is provided in `examples/openclaw/` for a one-click deployment of OpenClaw + VaultAgent Dashboard:

```bash
cd examples/openclaw
docker compose up -d

# Dashboard:  http://localhost:3000
# OpenClaw:   http://localhost:3001
```

## Policy Examples

### Development: Permissive

Allow most tools, require approval only for shell commands:

```yaml
version: 1
defaultDecision: allow

rules:
  - pattern: "bash"
    decision: require_approval
  - pattern: "exec_command"
    decision: require_approval
```

### Production: Restrictive

Deny by default, explicitly allow only what's needed:

```yaml
version: 1
defaultDecision: deny

rules:
  - pattern: "fs_read"
    decision: allow
  - pattern: "fs_list"
    decision: allow
  - pattern: "fs_search"
    decision: allow
```

### API-Focused Agent

Allow HTTP requests to specific domains:

```yaml
version: 1
defaultDecision: deny

rules:
  - pattern: "http_request"
    decision: allow
    argConstraints:
      url: "^https://api\\.company\\.com/.*"
  - pattern: "http_request"
    decision: deny
```

## OpenClaw Plugin

For deeper integration beyond MCP, VaultAgent provides an OpenClaw plugin that hooks into the agent's tool call lifecycle directly. See the [`openclaw-plugin/`](../../openclaw-plugin/) directory and its [README](../../openclaw-plugin/README.md).

## Troubleshooting

### "Missing '--' separator before upstream command"

The VaultAgent MCP proxy expects a `--` separator between its own flags and the upstream MCP server command. Make sure your `args` array includes `"--"` before the upstream command.

### Policy not loading

- Verify the policy file path is absolute or relative to the working directory.
- Check the proxy stderr output for parsing errors: `[vaultagent-mcp] Fatal error: ...`
- Validate your YAML syntax — the policy uses `version` (number), `defaultDecision`, and `rules` (array).

### Tools not appearing

The MCP proxy forwards `listTools` from the upstream server. If no tools appear:

1. Test the upstream server directly (without the proxy) to confirm it works.
2. Check that the upstream command and args are correct.
3. Look at stderr for connection errors.

### Audit events not reaching the Dashboard

- Confirm `--cloud-endpoint` points to your Dashboard's `/api/v1/ingest` route.
- Confirm `--cloud-api-key` matches an agent API key configured in the Dashboard.
- Events are buffered — they may take up to 10 seconds to appear.

## See Also

- [MCP Proxy Integration](./mcp.md) — General MCP proxy documentation.
- [Policy Reference](../policy-reference.md) — Full policy specification.
- [Dashboard Guide](../dashboard-guide.md) — Using the web dashboard.
