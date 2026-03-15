// API route: Policy configuration fetch and update

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { PolicyConfig, AgentPolicy } from "@/lib/types";
import { getPolicies, updatePolicies } from "@/lib/store";

/**
 * Validate a policy config object.
 * Returns an error message if invalid, or null if valid.
 */
function validatePolicyConfig(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return "Policy config must be a JSON object";
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.version !== "string" || obj.version.length === 0) {
    return "'version' must be a non-empty string";
  }

  if (typeof obj.defaultAction !== "string" || obj.defaultAction.length === 0) {
    return "'defaultAction' must be a non-empty string";
  }

  if (!Array.isArray(obj.agents)) {
    return "'agents' must be an array";
  }

  for (let i = 0; i < obj.agents.length; i++) {
    const agentError = validateAgentPolicy(obj.agents[i] as unknown, i);
    if (agentError) {
      return agentError;
    }
  }

  return null;
}

/**
 * Validate a single agent policy entry within the agents array.
 */
function validateAgentPolicy(agent: unknown, index: number): string | null {
  if (typeof agent !== "object" || agent === null) {
    return `agents[${index}] must be a non-null object`;
  }

  const obj = agent as Record<string, unknown>;

  if (typeof obj.agentId !== "string" || obj.agentId.length === 0) {
    return `agents[${index}].agentId must be a non-empty string`;
  }

  // Validate optional rules array
  if (obj.rules !== undefined) {
    if (!Array.isArray(obj.rules)) {
      return `agents[${index}].rules must be an array if provided`;
    }
    for (let j = 0; j < obj.rules.length; j++) {
      const rule = obj.rules[j] as Record<string, unknown> | null;
      if (typeof rule !== "object" || rule === null) {
        return `agents[${index}].rules[${j}] must be a non-null object`;
      }
      if (typeof rule.tool !== "string" || rule.tool.length === 0) {
        return `agents[${index}].rules[${j}].tool must be a non-empty string`;
      }
      const validActions = new Set(["allow", "deny", "require_approval"]);
      if (typeof rule.action !== "string" || !validActions.has(rule.action)) {
        return `agents[${index}].rules[${j}].action must be one of: allow, deny, require_approval`;
      }
    }
  }

  // Validate optional string-array fields
  const arrayFields = ["allowedTools", "deniedTools", "requireApproval"] as const;
  for (const field of arrayFields) {
    if (obj[field] !== undefined) {
      if (!Array.isArray(obj[field])) {
        return `agents[${index}].${field} must be an array if provided`;
      }
      const arr = obj[field] as unknown[];
      if (arr.some((item) => typeof item !== "string")) {
        return `agents[${index}].${field} must contain only strings`;
      }
    }
  }

  if (obj.rateLimit !== undefined && typeof obj.rateLimit !== "number") {
    return `agents[${index}].rateLimit must be a number if provided`;
  }

  return null;
}

/**
 * GET /api/v1/policy
 *
 * Returns the current policy config. Optionally filter by agentId query param.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  const policy = getPolicies();

  if (agentId) {
    const agentPolicy: AgentPolicy | undefined = policy.agents.find(
      (a: AgentPolicy) => a.agentId === agentId,
    );

    if (!agentPolicy) {
      return NextResponse.json(
        { error: `No policy found for agentId '${agentId}'` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      version: policy.version,
      defaultAction: policy.defaultAction,
      agent: agentPolicy,
    });
  }

  return NextResponse.json(policy);
}

/**
 * PUT /api/v1/policy
 *
 * Replace the entire policy config with the provided JSON body.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const validationError = validatePolicyConfig(body);
  if (validationError) {
    return NextResponse.json(
      { error: validationError },
      { status: 400 },
    );
  }

  const config = body as PolicyConfig;
  updatePolicies(config);

  return NextResponse.json(getPolicies());
}
