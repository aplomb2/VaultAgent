# Dashboard Guide

The VaultAgent Dashboard is a Next.js web application that provides real-time visibility and control over your AI agents' tool usage. It connects to the VaultAgent Cloud API to display audit logs, manage policies, and handle approval workflows.

## Setting Up the Dashboard

### Prerequisites

- Node.js 18 or later
- npm or yarn

### Installation

```bash
cd dashboard
npm install
```

### Development

```bash
npm run dev
```

The dashboard starts at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm run start
```

### Environment Configuration

The dashboard connects to the VaultAgent Cloud API. Configure the API endpoint and credentials through environment variables or the dashboard settings page. When using VaultAgent Cloud, sign up at [vaultagent.dev](https://vaultagent.dev) to get your API key.

## Overview Page

The overview page displays aggregate statistics about your agents' activity:

- **Total Calls** -- Total number of tool calls processed.
- **Denied Calls** -- Number of tool calls blocked by policy.
- **Pending Approvals** -- Approval requests waiting for human review.
- **Allow Rate** -- Percentage of tool calls that were allowed.

Use this page to get a quick health check on your agents and spot anomalies.

## Agent Management

The agent management section lists all registered agents with their current status:

| Field | Description |
|-------|-------------|
| **Name** | Human-readable agent name. |
| **Status** | `active`, `inactive`, or `suspended`. |
| **API Key** | The agent's API key (masked in the UI). |
| **Created At** | When the agent was first registered. |
| **Last Seen** | Timestamp of the agent's most recent tool call. |
| **Total Calls** | Lifetime count of tool calls. |
| **Denied Calls** | Lifetime count of denied tool calls. |

From this view you can:

- Create new agents and generate API keys.
- Suspend or reactivate agents.
- View per-agent audit logs and policy details.

## Policy Editor

The policy editor provides a visual interface for managing permission rules. You can:

- View all agents and their tool rules in a structured table.
- Add, edit, or remove individual rules.
- Set the action for each rule (`allow`, `deny`, `require_approval`).
- Define constraints (tables, operations, paths, domains, max_rows).
- Configure rate limits per agent.
- Set the default action for unmatched tool calls.

Changes made in the policy editor are synced to the VaultAgent Cloud API and take effect immediately for all connected SDK instances running in cloud mode.

### Policy Data Model

The dashboard uses the following structure for policies:

```typescript
interface PolicyConfig {
  version: string;
  agents: AgentPolicy[];
  defaultAction: string;
}

interface AgentPolicy {
  agentId: string;
  description: string;
  rules: PolicyRule[];
}

interface PolicyRule {
  tool: string;
  action: "allow" | "deny" | "require_approval";
  constraints?: Record<string, unknown>;
}
```

See the [Policy Reference](policy-reference.md) for full documentation of the YAML format and all available options.

## Approval Workflows

When an agent's tool call matches a `require_approval` rule, VaultAgent creates an approval request. The approval queue in the dashboard shows:

| Field | Description |
|-------|-------------|
| **Agent ID** | Which agent triggered the request. |
| **Tool** | The tool that requires approval. |
| **Input Args** | The arguments the agent wants to pass to the tool. |
| **Status** | `pending`, `approved`, or `rejected`. |
| **Created At** | When the request was created. |
| **Resolved At** | When a human approved or rejected the request. |
| **Resolved By** | Who made the approval decision. |

### Workflow

1. The agent calls a tool that has `action: require_approval` in the policy.
2. The SDK raises an `ApprovalRequiredError`.
3. In cloud mode, the approval request is submitted to VaultAgent Cloud.
4. The request appears in the dashboard's approval queue.
5. A team member reviews the request and approves or rejects it.
6. The calling application can poll for the approval result or receive a webhook notification.

## Audit Log Viewer

The audit log viewer displays a chronological feed of every tool call decision. Each entry includes:

| Field | Description |
|-------|-------------|
| **Timestamp** | When the decision was made (ISO-8601). |
| **Agent ID** | The agent that made the call. |
| **Tool** | The tool that was called. |
| **Action** | The decision: `allow`, `deny`, or `require_approval`. |
| **Denial Reason** | Why the call was denied (if applicable). |
| **Input Args** | The tool arguments (omitted when input redaction is enabled). |
| **Session ID** | Optional session identifier for grouping related events. |
| **Latency** | Policy evaluation time in milliseconds. |

### Filtering and Search

The audit log supports filtering by:

- Agent ID
- Tool name
- Action (allow/deny/require_approval)
- Time range

## API Endpoints

The dashboard communicates with the VaultAgent Cloud API. These are the core endpoints used by both the dashboard and the SDK in cloud mode.

### `POST /api/v1/ingest`

Receive a batch of audit events from the SDK.

**Request:**
```json
{
  "events": [
    {
      "timestamp": "2025-01-15T10:30:00Z",
      "agent_id": "my-agent",
      "tool": "database.query",
      "action": "allow",
      "constraints_applied": ["operation_whitelist: ['SELECT']"],
      "latency_ms": 2
    }
  ]
}
```

**Headers:**
- `Authorization: Bearer <api_key>`
- `Content-Type: application/json`

### `GET /api/v1/policy`

Fetch the policy for an agent.

**Query Parameters:**
- `agent_id` -- The agent to fetch the policy for.

**Response:**
```json
{
  "version": "1.0",
  "agents": { ... },
  "defaults": {
    "action": "deny",
    "log_level": "all"
  }
}
```

### `POST /api/v1/approvals`

Submit a new approval request.

**Request:**
```json
{
  "agent_id": "my-agent",
  "tool": "email.send",
  "input": {
    "to": "customer@example.com",
    "subject": "Refund confirmation"
  },
  "timeout_seconds": 300
}
```

**Response:**
```json
{
  "id": "appr_abc123",
  "status": "pending",
  "created_at": "2025-01-15T10:30:00Z"
}
```

## Technology Stack

The dashboard is built with:

- **Next.js 14** -- React framework with server-side rendering.
- **TypeScript** -- Type-safe development.
- **Tailwind CSS 4** -- Utility-first styling.
- **Recharts** -- Charts and data visualization.
- **Lucide React** -- Icon library.
