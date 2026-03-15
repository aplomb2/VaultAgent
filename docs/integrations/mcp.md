# MCP Proxy Integration

VaultAgent can run as an MCP (Model Context Protocol) proxy server, adding permission control and audit logging to any upstream MCP server. The proxy sits between the MCP client (such as Claude Desktop or Cursor) and the upstream MCP server, intercepting every tool call and validating it against your VaultAgent policy.

## Overview

```
MCP Client (Claude Desktop, Cursor, etc.)
    |
    v
VaultAgent MCP Proxy          <-- policy enforcement + audit logging
    |
    v
Upstream MCP Server (GitHub, filesystem, database, etc.)
```

## Installation

The MCP proxy server is a Node.js/TypeScript application.

```bash
cd mcp-server
npm install
npm run build
```

### Dependencies

- `@modelcontextprotocol/sdk` -- MCP protocol implementation.
- `js-yaml` -- YAML policy file parsing.
- `zod` -- Schema validation.

## Configuration

### Command-Line Usage

```bash
vaultagent-mcp \
  --upstream "npx -y @modelcontextprotocol/server-github" \
  --policy vaultagent.policy.yaml \
  --api-key va_sk_xxx
```

| Flag | Description |
|------|-------------|
| `--upstream` | Command to start the upstream MCP server. |
| `--policy` | Path to the VaultAgent YAML policy file. |
| `--api-key` | VaultAgent Cloud API key for remote audit logging (optional). |

### Development Mode

```bash
npm run dev
```

Uses `tsx` for live TypeScript execution without a build step.

## How It Works

1. **Startup:** The proxy starts both itself and the upstream MCP server.
2. **Tool discovery:** When the client requests the list of available tools, the proxy forwards the request to the upstream server and returns the tool list to the client.
3. **Tool call interception:** When the client invokes a tool:
   - The proxy extracts the tool name and arguments.
   - It evaluates the call against the loaded VaultAgent policy.
   - If **allowed**, the call is forwarded to the upstream server. The response is passed back to the client.
   - If **denied**, the proxy returns an error response without contacting the upstream server.
   - If **require_approval**, the proxy pauses the call and (in cloud mode) submits an approval request.
4. **Audit logging:** Every tool call decision is logged to a local JSONL file and optionally reported to VaultAgent Cloud.

## Audit Logging

The MCP proxy includes its own audit logger that writes to `vaultagent-mcp-audit.jsonl` by default.

### Audit Event Format

Each line in the JSONL file is a JSON object:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "tool": "github.create_issue",
  "decision": "allow",
  "argsHash": "a1b2c3d4...",
  "agentId": "claude-desktop",
  "durationMs": 245
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO-8601 timestamp. |
| `tool` | string | MCP tool name. |
| `decision` | string | `"allow"`, `"deny"`, or `"require_approval"`. |
| `argsHash` | string | SHA-256 hash of the tool arguments (privacy-preserving). |
| `agentId` | string | Identifier of the calling agent/session (optional). |
| `requestId` | string | Upstream request ID for correlation (optional). |
| `durationMs` | number | Duration of the upstream call in milliseconds (optional). |
| `error` | string | Error message if the upstream call failed (optional). |

### Cloud Reporting

When `cloudEndpoint` and `cloudApiKey` are configured, the audit logger buffers events and sends them in batches to the VaultAgent Cloud API:

- **Buffer size:** 50 events (configurable).
- **Flush interval:** 10 seconds (configurable).
- **Retry:** Failed batches are re-queued for the next flush cycle.
- **Graceful shutdown:** Call `logger.close()` before process exit to flush remaining events.

## Usage with Claude Desktop

To use VaultAgent MCP Proxy with Claude Desktop, add it to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "github-protected": {
      "command": "node",
      "args": [
        "/path/to/vaultagent/mcp-server/dist/index.js",
        "--upstream", "npx -y @modelcontextprotocol/server-github",
        "--policy", "/path/to/vaultagent.policy.yaml"
      ],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

This configuration starts the VaultAgent MCP proxy, which in turn starts the GitHub MCP server as its upstream. Claude Desktop sees the same tools, but every call goes through VaultAgent policy enforcement.

## Example Policy for MCP Tools

```yaml
version: "1.0"

defaults:
  action: deny

agents:
  claude-desktop:
    description: "Claude Desktop with protected MCP tool access"
    tools:
      # Allow reading GitHub issues and PRs
      - tool: "github.list_issues"
        action: allow
      - tool: "github.get_issue"
        action: allow
      - tool: "github.list_pull_requests"
        action: allow

      # Require approval for write operations
      - tool: "github.create_issue"
        action: require_approval
      - tool: "github.create_pull_request"
        action: require_approval

      # Deny destructive operations
      - tool: "github.delete_*"
        action: deny

      # Deny everything else
      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 20
      max_calls_per_hour: 200
```

## See Also

- [Getting Started](../getting-started.md) -- Quick introduction to VaultAgent.
- [Policy Reference](../policy-reference.md) -- Full YAML policy specification.
- [Dashboard Guide](../dashboard-guide.md) -- Using the web dashboard to monitor MCP tool usage.
