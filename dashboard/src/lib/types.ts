// Core type definitions for VaultAgent Dashboard

export interface Agent {
  id: string;
  name: string;
  status: "active" | "inactive" | "suspended";
  apiKey: string;
  createdAt: string;
  lastSeen: string;
  totalCalls: number;
  deniedCalls: number;
}

export interface PolicyRule {
  tool: string;
  action: "allow" | "deny" | "require_approval";
  constraints?: Record<string, unknown>;
}

export interface AgentPolicy {
  agentId: string;
  description?: string;
  rules: PolicyRule[];
  allowedTools?: string[];
  deniedTools?: string[];
  requireApproval?: string[];
  rateLimit?: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyConfig {
  version: string;
  agents: AgentPolicy[];
  defaultAction: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  tool: string;
  action: "allow" | "deny" | "require_approval";
  denialReason?: string;
  inputArgs?: Record<string, unknown>;
  sessionId?: string;
  latencyMs?: number;
}

export interface Approval {
  id: string;
  agentId: string;
  tool: string;
  inputArgs: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Stats {
  totalCalls: number;
  deniedCalls: number;
  pendingApprovals: number;
  allowRate: number;
}

export interface UserPlan {
  plan: string;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  maxAgents: number;
  maxEventsPerDay: number;
  eventsToday: number;
  stripeCustomerId: string | null;
  isGracePeriod: boolean;
}
