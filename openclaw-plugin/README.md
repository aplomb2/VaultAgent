# @vaultagent/openclaw-plugin

VaultAgent permission enforcement plugin for [OpenClaw](https://github.com/openclawai/openclaw). Intercepts tool calls at the code level, enforcing policy decisions and logging audit events.

## When to Use This vs the MCP Proxy

| Approach | Best for |
|---|---|
| **MCP Proxy** (`vaultagent-mcp`) | MCP-based tool calls. Zero code changes. Works with any MCP client. |
| **This Plugin** (`@vaultagent/openclaw-plugin`) | Non-MCP tool calls. Deep integration into OpenClaw's extension system. |

You can use both together — the MCP proxy handles MCP tools while the plugin handles custom tools.

## Installation

```bash
cd openclaw-plugin
npm install
npm run build
```

## Usage

```typescript
import {
  activate,
  deactivate,
  handleBeforeToolCall,
  handleAfterToolCall,
  getStatus,
} from "@vaultagent/openclaw-plugin";

// Activate with a policy file
await activate({
  policyPath: "./vaultagent.policy.yaml",
  agentId: "openclaw",
  // Optional: send audit events to VaultAgent Cloud
  cloudEndpoint: "https://your-dashboard.com/api/v1/ingest",
  cloudApiKey: "va_sk_xxx",
});

// Before each tool call
const result = await handleBeforeToolCall("fs_write", { path: "./src/app.ts", content: "..." });

if (!result.allowed) {
  // Tool call was denied or requires approval
  console.error(result.message);
} else {
  // Proceed with tool execution
  const start = performance.now();
  try {
    const output = await executeTool("fs_write", { path: "./src/app.ts", content: "..." });
    await handleAfterToolCall("fs_write", { path: "./src/app.ts" }, Math.round(performance.now() - start));
  } catch (err) {
    await handleAfterToolCall("fs_write", { path: "./src/app.ts" }, Math.round(performance.now() - start), String(err));
  }
}

// Query tool permissions for agent introspection
const statuses = getStatus(["fs_read", "fs_write", "bash", "exec_command"]);
console.log(statuses);
// [
//   { tool: "fs_read",      decision: "allow",            matchedRule: "fs_read" },
//   { tool: "fs_write",     decision: "allow",            matchedRule: "fs_write" },
//   { tool: "bash",         decision: "require_approval", matchedRule: "bash" },
//   { tool: "exec_command", decision: "require_approval", matchedRule: "exec_command" },
// ]

// Clean up
await deactivate();
```

## Configuration

| Option | Required | Description |
|---|---|---|
| `policyPath` | Yes | Path to `vaultagent.policy.yaml` |
| `auditPath` | No | Path to local audit JSONL file (default: `vaultagent-mcp-audit.jsonl`) |
| `cloudEndpoint` | No | VaultAgent Cloud API endpoint for remote reporting |
| `cloudApiKey` | No | API key for VaultAgent Cloud |
| `agentId` | No | Identifier for this agent session |

## Policy Format

Uses the same YAML format as the VaultAgent MCP proxy. See [`examples/openclaw/vaultagent.policy.yaml`](../examples/openclaw/vaultagent.policy.yaml) for a complete example.

## See Also

- [OpenClaw Integration Guide](../docs/integrations/openclaw.md) — Full setup guide including MCP proxy.
- [MCP Proxy](../mcp-server/) — MCP-level integration (no code changes required).
