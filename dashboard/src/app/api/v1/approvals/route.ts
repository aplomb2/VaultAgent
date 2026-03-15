// API route: Approval request CRUD

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { auth } from "@/lib/auth";

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

  return { agent };
}

/**
 * GET /api/v1/approvals
 *
 * List approvals for agent. Supports optional `?status=pending` query filter.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await authenticateAgent(request);
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { agent } = authResult;
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  let query = supabase
    .from("approvals")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    const valid = new Set(["pending", "approved", "rejected"]);
    if (!valid.has(statusFilter)) {
      return NextResponse.json(
        { error: "Invalid status filter. Must be one of: pending, approved, rejected" },
        { status: 400 },
      );
    }
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }

  return NextResponse.json({ approvals: data ?? [], count: data?.length ?? 0 });
}

/**
 * POST /api/v1/approvals
 *
 * Create a new approval request.
 * Body: `{ tool, inputArgs }`
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

  const obj = body as Record<string, unknown>;

  if (typeof obj.tool !== "string" || obj.tool.length === 0) {
    return NextResponse.json(
      { error: "'tool' must be a non-empty string" },
      { status: 400 },
    );
  }

  if (typeof obj.inputArgs !== "object" || obj.inputArgs === null || Array.isArray(obj.inputArgs)) {
    return NextResponse.json(
      { error: "'inputArgs' must be a non-null, non-array object" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("approvals")
    .insert({
      agent_id: agent.id,
      user_id: agent.user_id,
      tool: obj.tool,
      input_args: obj.inputArgs,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("approval insert error:", error);
    return NextResponse.json({ error: "Failed to create approval" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/v1/approvals
 *
 * Resolve an existing approval. Requires dashboard auth session.
 * Body: `{ id, status: 'approved' | 'rejected' }`
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // PATCH requires dashboard session auth, not API key
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  const obj = body as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.length === 0) {
    return NextResponse.json(
      { error: "'id' must be a non-empty string" },
      { status: 400 },
    );
  }

  if (obj.status !== "approved" && obj.status !== "rejected") {
    return NextResponse.json(
      { error: "'status' must be 'approved' or 'rejected'" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("approvals")
    .update({
      status: obj.status,
      resolved_at: new Date().toISOString(),
      resolved_by: session.user.email,
    })
    .eq("id", obj.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error || !data) {
    // Check if it exists
    const { data: existing } = await supabase
      .from("approvals")
      .select("id, status")
      .eq("id", obj.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: `Approval with id '${obj.id}' not found` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: `Approval '${obj.id}' has already been resolved with status '${existing.status}'` },
      { status: 409 },
    );
  }

  return NextResponse.json(data);
}
