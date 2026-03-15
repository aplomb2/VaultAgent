"use server";

// Supabase-backed data layer — all functions are server actions

import { createServiceClient } from "./supabase";
import type {
  Agent,
  AuditLogEntry,
  Approval,
  PolicyConfig,
  Stats,
} from "./types";

export interface AuditLogFilters {
  agentId?: string;
  action?: AuditLogEntry["action"];
  search?: string;
  startDate?: string;
  endDate?: string;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(userId: string): Promise<Stats> {
  const supabase = createServiceClient();

  const [agentsRes, approvalsRes] = await Promise.all([
    supabase.from("agents").select("total_calls, denied_calls").eq("user_id", userId),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending"),
  ]);

  const agents = agentsRes.data ?? [];
  const totalCalls = agents.reduce((sum, a) => sum + (a.total_calls ?? 0), 0);
  const deniedCalls = agents.reduce((sum, a) => sum + (a.denied_calls ?? 0), 0);
  const pendingApprovals = approvalsRes.count ?? 0;
  const allowRate = totalCalls > 0 ? ((totalCalls - deniedCalls) / totalCalls) * 100 : 0;

  return { totalCalls, deniedCalls, pendingApprovals, allowRate };
}

// ── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(userId: string): Promise<Agent[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAgents error:", error);
    return [];
  }

  return (data ?? []).map(mapAgent);
}

export async function addAgent(userId: string, name: string): Promise<Agent> {
  const supabase = createServiceClient();
  const apiKey = `va_sk_${Array.from({ length: 20 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36))
  ).join("")}`;

  const { data, error } = await supabase
    .from("agents")
    .insert({
      user_id: userId,
      name,
      api_key: apiKey,
      status: "active",
      total_calls: 0,
      denied_calls: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create agent: ${error.message}`);
  return mapAgent(data);
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(
  userId: string,
  filters?: AuditLogFilters
): Promise<AuditLogEntry[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters?.agentId) {
    query = query.eq("agent_id", filters.agentId);
  }
  if (filters?.action) {
    query = query.eq("action", filters.action);
  }
  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAuditLogs error:", error);
    return [];
  }

  let logs = (data ?? []).map(mapAuditLog);

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.tool.toLowerCase().includes(term) ||
        l.denialReason?.toLowerCase().includes(term) ||
        l.agentId.toLowerCase().includes(term)
    );
  }

  return logs;
}

// ── Approvals ────────────────────────────────────────────────────────────────

export async function getApprovals(userId: string): Promise<Approval[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getApprovals error:", error);
    return [];
  }

  return (data ?? []).map(mapApproval);
}

export async function resolveApproval(
  id: string,
  resolution: "approved" | "rejected",
  resolvedBy: string
): Promise<Approval | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("approvals")
    .update({
      status: resolution,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) {
    console.error("resolveApproval error:", error);
    return null;
  }

  return mapApproval(data);
}

// ── Policies ─────────────────────────────────────────────────────────────────

export async function getPolicies(userId: string): Promise<PolicyConfig> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("policies")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return { version: "1.0.0", defaultAction: "deny", agents: [] };
  }

  const config = data.config as PolicyConfig;
  return {
    version: data.version ?? config.version ?? "1.0.0",
    defaultAction: config.defaultAction ?? "deny",
    agents: config.agents ?? [],
  };
}

export async function updatePolicies(
  userId: string,
  config: PolicyConfig
): Promise<void> {
  const supabase = createServiceClient();

  // Try update first, then insert if no rows matched
  const { data: existing } = await supabase
    .from("policies")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "default")
    .single();

  if (existing) {
    const { error } = await supabase
      .from("policies")
      .update({
        config: config as unknown as Record<string, unknown>,
        version: config.version,
      })
      .eq("id", existing.id);

    if (error) throw new Error(`Failed to update policies: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("policies")
      .insert({
        user_id: userId,
        name: "default",
        config: config as unknown as Record<string, unknown>,
        version: config.version,
      });

    if (error) throw new Error(`Failed to create policies: ${error.message}`);
  }
}

// ── Hourly Volume ────────────────────────────────────────────────────────────

export async function getHourlyVolume(
  userId: string
): Promise<Array<{ hour: string; allowed: number; denied: number }>> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("created_at, action")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  const buckets: Record<string, { allowed: number; denied: number }> = {};

  for (const row of data) {
    const dt = new Date(row.created_at);
    const label = dt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const hourKey = label.replace(/:\d{2}$/, ":00");
    if (!buckets[hourKey]) buckets[hourKey] = { allowed: 0, denied: 0 };
    if (row.action === "deny") {
      buckets[hourKey].denied++;
    } else {
      buckets[hourKey].allowed++;
    }
  }

  return Object.entries(buckets).map(([hour, counts]) => ({
    hour,
    ...counts,
  }));
}

// ── Agent Name Lookup ────────────────────────────────────────────────────────

export async function getAgentName(
  userId: string,
  agentId: string
): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agents")
    .select("name")
    .eq("id", agentId)
    .eq("user_id", userId)
    .single();

  return data?.name ?? agentId;
}

export async function getAgentNames(
  userId: string
): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agents")
    .select("id, name")
    .eq("user_id", userId);

  const names: Record<string, string> = {};
  for (const row of data ?? []) {
    names[row.id] = row.name;
  }
  return names;
}

// ── User Lookup ──────────────────────────────────────────────────────────────

export async function getUserByEmail(
  email: string
): Promise<{ id: string } | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  return data;
}

// ── Row Mappers ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapAgent(row: any): Agent {
  return {
    id: row.id,
    name: row.name,
    status: row.status ?? "active",
    apiKey: row.api_key,
    createdAt: row.created_at,
    lastSeen: row.last_seen_at ?? row.created_at,
    totalCalls: row.total_calls ?? 0,
    deniedCalls: row.denied_calls ?? 0,
  };
}

function mapAuditLog(row: any): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.created_at,
    agentId: row.agent_id,
    tool: row.tool,
    action: row.action,
    denialReason: row.denial_reason ?? undefined,
    inputArgs: row.input_args ?? undefined,
    sessionId: row.session_id ?? undefined,
    latencyMs: row.latency_ms ?? undefined,
  };
}

function mapApproval(row: any): Approval {
  return {
    id: row.id,
    agentId: row.agent_id,
    tool: row.tool,
    inputArgs: row.input_args ?? {},
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
