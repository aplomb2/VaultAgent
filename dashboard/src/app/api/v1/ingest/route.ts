// API route: SDK audit log ingestion endpoint

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { PLAN_LIMITS, getEffectivePlan, type PlanName } from "@/lib/stripe";

const VALID_ACTIONS = new Set(["allow", "deny", "require_approval"]);

// Validate an incoming event object
function validateEntry(entry: unknown): string | null {
  if (typeof entry !== "object" || entry === null) {
    return "Each event must be a non-null object";
  }

  const obj = entry as Record<string, unknown>;

  if (typeof obj.tool !== "string" || obj.tool.length === 0) {
    return "Event 'tool' must be a non-empty string";
  }
  if (typeof obj.action !== "string" || !VALID_ACTIONS.has(obj.action)) {
    return "Event 'action' must be one of: allow, deny, require_approval";
  }

  if (obj.denialReason !== undefined && typeof obj.denialReason !== "string") {
    return "Event 'denialReason' must be a string if provided";
  }
  if (obj.inputArgs !== undefined && (typeof obj.inputArgs !== "object" || obj.inputArgs === null)) {
    return "Event 'inputArgs' must be an object if provided";
  }
  if (obj.sessionId !== undefined && typeof obj.sessionId !== "string") {
    return "Event 'sessionId' must be a string if provided";
  }
  if (obj.latencyMs !== undefined && typeof obj.latencyMs !== "number") {
    return "Event 'latencyMs' must be a number if provided";
  }

  return null;
}

// Look up agent by Bearer token (api_key)
async function authenticateAgent(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or malformed Authorization header", status: 401 };
  }

  const token = authHeader.slice("Bearer ".length);
  const supabase = createServiceClient();
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, user_id, status")
    .eq("api_key", token)
    .single();

  if (error || !agent) {
    return { error: "Invalid API key", status: 401 };
  }

  if (agent.status === "suspended") {
    return { error: "Agent is suspended", status: 403 };
  }

  return { agent };
}

/**
 * POST /api/v1/ingest
 *
 * Accepts a single audit event or a batch: `{ events: [...] }`.
 * Authenticates via agent api_key, inserts into audit_logs.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await authenticateAgent(request);
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { agent } = authResult;

  // ── Quota check ───────────────────────────────────────────────────────────
  const supabaseForQuota = createServiceClient();
  const { data: owner } = await supabaseForQuota
    .from("users")
    .select("plan, subscription_status, subscription_ends_at")
    .eq("id", agent.user_id)
    .single();

  const effectivePlan = getEffectivePlan(owner ?? {});
  const limits = PLAN_LIMITS[effectivePlan as PlanName];

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;

  // Normalize: accept `{ events: [...] }` or a single event object
  let events: unknown[];
  if (Array.isArray(payload.events)) {
    events = payload.events;
  } else if (typeof payload.tool === "string") {
    events = [payload];
  } else {
    return NextResponse.json(
      { error: "Body must contain an 'events' array or be a single event object with a 'tool'" },
      { status: 400 },
    );
  }

  if (events.length === 0) {
    return NextResponse.json(
      { error: "Events array must not be empty" },
      { status: 400 },
    );
  }

  // Validate every entry before storing any
  for (let i = 0; i < events.length; i++) {
    const validationError = validateEntry(events[i]);
    if (validationError) {
      return NextResponse.json(
        { error: `Event at index ${i}: ${validationError}` },
        { status: 400 },
      );
    }
  }

  // Check daily event quota
  if (limits.maxEventsPerDay > 0) {
    const { data: quotaResult, error: quotaError } = await supabaseForQuota
      .rpc("check_and_increment_events", {
        p_user_id: agent.user_id,
        p_count: events.length,
        p_daily_limit: limits.maxEventsPerDay,
      });

    if (quotaError) {
      console.error("Quota check error:", quotaError);
      // Non-fatal: allow the request if the RPC doesn't exist yet
    } else if (quotaResult === -1) {
      return NextResponse.json(
        {
          error: "Daily event quota exceeded",
          plan: effectivePlan,
          limit: limits.maxEventsPerDay,
          upgrade_url: "/dashboard/billing",
        },
        { status: 429 },
      );
    }
  }

  const supabase = createServiceClient();

  // Build rows to insert
  const rows = events.map((e) => {
    const ev = e as Record<string, unknown>;
    return {
      agent_id: agent.id,
      user_id: agent.user_id,
      tool: ev.tool as string,
      action: ev.action as string,
      input_args: ev.inputArgs ?? null,
      input_hash: null,
      denial_reason: ev.denialReason ?? null,
      latency_ms: ev.latencyMs ?? null,
      session_id: ev.sessionId ?? null,
      metadata: ev.metadata ?? null,
    };
  });

  const { error: insertError } = await supabase.from("audit_logs").insert(rows);
  if (insertError) {
    console.error("audit_logs insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to store events" },
      { status: 500 },
    );
  }

  // Increment agent counters
  const deniedCount = events.filter((e) => (e as Record<string, unknown>).action === "deny").length;
  const { error: updateError } = await supabase.rpc("increment_agent_counters", {
    p_agent_id: agent.id,
    p_total: events.length,
    p_denied: deniedCount,
  });

  // If the RPC doesn't exist, fall back to a manual update
  if (updateError) {
    const { data: currentAgent } = await supabase
      .from("agents")
      .select("total_calls, denied_calls")
      .eq("id", agent.id)
      .single();

    if (currentAgent) {
      await supabase
        .from("agents")
        .update({
          total_calls: (currentAgent.total_calls ?? 0) + events.length,
          denied_calls: (currentAgent.denied_calls ?? 0) + deniedCount,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", agent.id);
    }
  }

  return NextResponse.json(
    { success: true, count: events.length },
    { status: 200 },
  );
}
