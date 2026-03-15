// Demo/mock data shown when a user has no real data yet

import type {
  Agent,
  AuditLogEntry,
  Approval,
  PolicyConfig,
  Stats,
} from "./types";

const demoAgents: Agent[] = [
  {
    id: "demo-agent-001",
    name: "CodeAssistant",
    status: "active",
    apiKey: "va_sk_a1b2c3d4e5f6g7h8i9j0",
    createdAt: "2026-02-01T08:00:00Z",
    lastSeen: "2026-03-15T09:42:00Z",
    totalCalls: 12847,
    deniedCalls: 312,
  },
  {
    id: "demo-agent-002",
    name: "DataPipeline",
    status: "active",
    apiKey: "va_sk_k1l2m3n4o5p6q7r8s9t0",
    createdAt: "2026-02-10T14:30:00Z",
    lastSeen: "2026-03-15T09:40:00Z",
    totalCalls: 8421,
    deniedCalls: 89,
  },
  {
    id: "demo-agent-003",
    name: "SecurityScanner",
    status: "active",
    apiKey: "va_sk_u1v2w3x4y5z6a7b8c9d0",
    createdAt: "2026-02-15T10:00:00Z",
    lastSeen: "2026-03-15T09:38:00Z",
    totalCalls: 5632,
    deniedCalls: 1204,
  },
  {
    id: "demo-agent-004",
    name: "DeployBot",
    status: "inactive",
    apiKey: "va_sk_e1f2g3h4i5j6k7l8m9n0",
    createdAt: "2026-01-20T16:00:00Z",
    lastSeen: "2026-03-10T22:15:00Z",
    totalCalls: 3210,
    deniedCalls: 45,
  },
  {
    id: "demo-agent-005",
    name: "MaliciousBot",
    status: "suspended",
    apiKey: "va_sk_o1p2q3r4s5t6u7v8w9x0",
    createdAt: "2026-03-01T12:00:00Z",
    lastSeen: "2026-03-12T03:22:00Z",
    totalCalls: 982,
    deniedCalls: 871,
  },
];

const toolNames = [
  "file_read",
  "file_write",
  "shell_exec",
  "http_request",
  "db_query",
  "secret_access",
  "deploy_trigger",
  "code_eval",
];

function generateDemoAuditLogs(): AuditLogEntry[] {
  const logs: AuditLogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < 200; i++) {
    const agent = demoAgents[Math.floor(Math.random() * demoAgents.length)];
    const tool = toolNames[Math.floor(Math.random() * toolNames.length)];
    const rand = Math.random();
    const action: AuditLogEntry["action"] =
      rand < 0.7 ? "allow" : rand < 0.9 ? "deny" : "require_approval";

    const entry: AuditLogEntry = {
      id: `demo-log-${String(i).padStart(4, "0")}`,
      timestamp: new Date(now - i * 180_000).toISOString(),
      agentId: agent.id,
      tool,
      action,
      latencyMs: Math.floor(Math.random() * 150) + 5,
      sessionId: `sess-${Math.floor(Math.random() * 50)}`,
    };

    if (action === "deny") {
      const reasons = [
        "Tool not permitted by policy",
        "Rate limit exceeded",
        "Sensitive path access blocked",
        "Unauthorized network target",
        "Insufficient permissions",
      ];
      entry.denialReason = reasons[Math.floor(Math.random() * reasons.length)];
    }

    if (action !== "deny") {
      entry.inputArgs = {
        path: `/workspace/src/file_${i}.ts`,
        mode: action === "allow" ? "read" : "write",
      };
    }

    logs.push(entry);
  }

  return logs;
}

const demoApprovals: Approval[] = [
  {
    id: "demo-appr-001",
    agentId: "demo-agent-001",
    tool: "shell_exec",
    inputArgs: { command: "rm -rf /tmp/cache/*", cwd: "/workspace" },
    status: "pending",
    createdAt: "2026-03-15T09:30:00Z",
  },
  {
    id: "demo-appr-002",
    agentId: "demo-agent-002",
    tool: "db_query",
    inputArgs: { query: "DROP TABLE staging_temp", database: "production" },
    status: "pending",
    createdAt: "2026-03-15T09:25:00Z",
  },
  {
    id: "demo-appr-003",
    agentId: "demo-agent-003",
    tool: "http_request",
    inputArgs: {
      url: "https://internal-api.corp.net/admin/users",
      method: "DELETE",
    },
    status: "pending",
    createdAt: "2026-03-15T09:20:00Z",
  },
  {
    id: "demo-appr-004",
    agentId: "demo-agent-001",
    tool: "secret_access",
    inputArgs: { key: "AWS_SECRET_ACCESS_KEY", vault: "production" },
    status: "pending",
    createdAt: "2026-03-15T09:15:00Z",
  },
  {
    id: "demo-appr-005",
    agentId: "demo-agent-002",
    tool: "deploy_trigger",
    inputArgs: { service: "api-gateway", environment: "production" },
    status: "approved",
    createdAt: "2026-03-15T08:00:00Z",
    resolvedAt: "2026-03-15T08:05:00Z",
    resolvedBy: "admin@vault.dev",
  },
  {
    id: "demo-appr-006",
    agentId: "demo-agent-005",
    tool: "file_write",
    inputArgs: { path: "/etc/passwd", content: "..." },
    status: "rejected",
    createdAt: "2026-03-14T22:00:00Z",
    resolvedAt: "2026-03-14T22:01:00Z",
    resolvedBy: "admin@vault.dev",
  },
];

const demoPolicyConfig: PolicyConfig = {
  version: "1.0.0",
  defaultAction: "deny",
  agents: [
    {
      agentId: "demo-agent-001",
      description: "Code assistant with broad read access and limited write",
      rules: [
        { tool: "file_read", action: "allow" },
        { tool: "file_write", action: "allow", constraints: { pathPrefix: "/workspace/src" } },
        { tool: "shell_exec", action: "require_approval" },
        { tool: "http_request", action: "allow", constraints: { maxBodySize: 1048576 } },
        { tool: "secret_access", action: "require_approval" },
        { tool: "deploy_trigger", action: "deny" },
      ],
    },
    {
      agentId: "demo-agent-002",
      description: "Data pipeline with database and deploy access",
      rules: [
        { tool: "file_read", action: "allow" },
        { tool: "file_write", action: "allow", constraints: { pathPrefix: "/data" } },
        { tool: "db_query", action: "allow", constraints: { readOnly: true } },
        { tool: "deploy_trigger", action: "require_approval" },
        { tool: "secret_access", action: "deny" },
      ],
    },
    {
      agentId: "demo-agent-003",
      description: "Security scanner with read-only access",
      rules: [
        { tool: "file_read", action: "allow" },
        { tool: "http_request", action: "allow" },
        { tool: "shell_exec", action: "deny" },
        { tool: "file_write", action: "deny" },
        { tool: "db_query", action: "deny" },
      ],
    },
  ],
};

function generateDemoHourlyVolume(): Array<{ hour: string; allowed: number; denied: number }> {
  const data: Array<{ hour: string; allowed: number; denied: number }> = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600_000);
    const label = hour.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const hourOfDay = hour.getHours();
    const isWorkHour = hourOfDay >= 8 && hourOfDay <= 18;
    const baseAllowed = isWorkHour ? 120 : 30;
    const baseDenied = isWorkHour ? 15 : 4;

    data.push({
      hour: label,
      allowed: baseAllowed + Math.floor(Math.random() * 60),
      denied: baseDenied + Math.floor(Math.random() * 10),
    });
  }

  return data;
}

// Build agent name lookup for demo data
const demoAgentNames: Record<string, string> = {};
for (const a of demoAgents) {
  demoAgentNames[a.id] = a.name;
}

export function getDemoStats(): Stats {
  const totalCalls = demoAgents.reduce((sum, a) => sum + a.totalCalls, 0);
  const deniedCalls = demoAgents.reduce((sum, a) => sum + a.deniedCalls, 0);
  const pendingApprovals = demoApprovals.filter((a) => a.status === "pending").length;
  const allowRate = totalCalls > 0 ? ((totalCalls - deniedCalls) / totalCalls) * 100 : 0;
  return { totalCalls, deniedCalls, pendingApprovals, allowRate };
}

export function getDemoAgents(): Agent[] {
  return [...demoAgents];
}

export function getDemoAuditLogs(): AuditLogEntry[] {
  return generateDemoAuditLogs();
}

export function getDemoApprovals(): Approval[] {
  return [...demoApprovals];
}

export function getDemoPolicies(): PolicyConfig {
  return JSON.parse(JSON.stringify(demoPolicyConfig)) as PolicyConfig;
}

export function getDemoHourlyVolume(): Array<{ hour: string; allowed: number; denied: number }> {
  return generateDemoHourlyVolume();
}

export function getDemoAgentNames(): Record<string, string> {
  return { ...demoAgentNames };
}
