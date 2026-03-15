// API route: SDK audit log ingestion endpoint

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { AuditLogEntry } from "@/lib/types";
import { pushAuditLogs, getApiKey } from "@/lib/store";

const VALID_ACTIONS = new Set(["allow", "deny", "require_approval"]);

/**
 * Validate that a value conforms to the AuditLogEntry shape.
 * Returns an error message string if invalid, or null if valid.
 */
function validateEntry(entry: unknown): string | null {
  if (typeof entry !== "object" || entry === null) {
    return "Each event must be a non-null object";
  }

  const obj = entry as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.length === 0) {
    return "Event 'id' must be a non-empty string";
  }
  if (typeof obj.timestamp !== "string" || obj.timestamp.length === 0) {
    return "Event 'timestamp' must be a non-empty string";
  }
  if (typeof obj.agentId !== "string" || obj.agentId.length === 0) {
    return "Event 'agentId' must be a non-empty string";
  }
  if (typeof obj.tool !== "string" || obj.tool.length === 0) {
    return "Event 'tool' must be a non-empty string";
  }
  if (typeof obj.action !== "string" || !VALID_ACTIONS.has(obj.action)) {
    return "Event 'action' must be one of: allow, deny, require_approval";
  }

  // Optional field type checks
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

/**
 * Verify the Bearer token if an API key is configured.
 * Returns an error response if authentication fails, or null if OK.
 */
function checkAuth(request: NextRequest): NextResponse | null {
  const apiKey = getApiKey();
  if (!apiKey) {
    // No API key configured; skip authentication
    return null;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.slice("Bearer ".length);
  if (token !== apiKey) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 403 },
    );
  }

  return null;
}

/**
 * POST /api/v1/ingest
 *
 * Accepts a single audit event or a batch: `{ events: AuditLogEntry[] }`.
 * Stores them in the in-memory audit log store.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = checkAuth(request);
  if (authError) {
    return authError;
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

  const payload = body as Record<string, unknown>;

  // Normalize: accept `{ events: [...] }` or a single event object
  let events: unknown[];
  if (Array.isArray(payload.events)) {
    events = payload.events;
  } else if (typeof payload.id === "string") {
    // Single event submitted directly
    events = [payload];
  } else {
    return NextResponse.json(
      { error: "Body must contain an 'events' array or be a single event object with an 'id'" },
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

  // All valid; store them
  const typedEvents = events as AuditLogEntry[];
  pushAuditLogs(typedEvents);

  return NextResponse.json(
    { success: true, count: typedEvents.length },
    { status: 200 },
  );
}
