// API route: Approval request CRUD

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Approval } from "@/lib/types";
import {
  getApprovals,
  getPendingApprovals,
  pushApproval,
  resolveApproval,
} from "@/lib/store";

const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

/**
 * Verify Bearer token against VAULTAGENT_API_SECRET.
 * Returns an error response if authentication fails, or null if OK.
 */
function checkApiAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.VAULTAGENT_API_SECRET;
  if (!secret) return null;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header" },
      { status: 401 },
    );
  }

  if (authHeader.slice("Bearer ".length) !== secret) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 },
    );
  }

  return null;
}

/**
 * Generate a random approval ID.
 */
function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "appr-" + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

/**
 * GET /api/v1/approvals
 *
 * List all approvals. Supports optional `?status=pending` query filter.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = checkApiAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  if (statusFilter && !VALID_STATUSES.has(statusFilter)) {
    return NextResponse.json(
      { error: "Invalid status filter. Must be one of: pending, approved, rejected" },
      { status: 400 },
    );
  }

  let filtered: Approval[];
  if (statusFilter === "pending") {
    filtered = getPendingApprovals();
  } else if (statusFilter) {
    filtered = getApprovals().filter((a: Approval) => a.status === statusFilter);
  } else {
    filtered = getApprovals();
  }

  return NextResponse.json({ approvals: filtered, count: filtered.length });
}

/**
 * POST /api/v1/approvals
 *
 * Create a new approval request.
 * Body: `{ agentId, tool, inputArgs }`
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = checkApiAuth(request);
  if (authError) return authError;

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

  if (typeof obj.agentId !== "string" || obj.agentId.length === 0) {
    return NextResponse.json(
      { error: "'agentId' must be a non-empty string" },
      { status: 400 },
    );
  }

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

  const approval: Approval = {
    id: generateId(),
    agentId: obj.agentId,
    tool: obj.tool,
    inputArgs: obj.inputArgs as Record<string, unknown>,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  pushApproval(approval);

  return NextResponse.json(approval, { status: 201 });
}

/**
 * PATCH /api/v1/approvals
 *
 * Resolve an existing approval.
 * Body: `{ id, status: 'approved' | 'rejected', resolvedBy }`
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authError = checkApiAuth(request);
  if (authError) return authError;

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

  if (typeof obj.resolvedBy !== "string" || obj.resolvedBy.length === 0) {
    return NextResponse.json(
      { error: "'resolvedBy' must be a non-empty string" },
      { status: 400 },
    );
  }

  const resolved = resolveApproval(obj.id, obj.status, obj.resolvedBy);
  if (!resolved) {
    // Could be not found or already resolved
    const existing = getApprovals().find((a: Approval) => a.id === obj.id);
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

  return NextResponse.json(resolved);
}
