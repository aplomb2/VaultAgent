// API route: Policy configuration fetch

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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
    .select("id, user_id")
    .eq("api_key", token)
    .single();

  if (error || !agent) {
    return { error: "Invalid API key", status: 401 };
  }

  return { agent };
}

/**
 * GET /api/v1/policy
 *
 * Returns the policy config for the agent's owner.
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

  const { data } = await supabase
    .from("policies")
    .select("*")
    .eq("user_id", agent.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return NextResponse.json({
      version: "1.0.0",
      defaultAction: "deny",
      agents: [],
    });
  }

  const config = data.config as Record<string, unknown>;

  // Optionally filter to this specific agent
  const { searchParams } = new URL(request.url);
  const agentIdFilter = searchParams.get("agentId");

  if (agentIdFilter) {
    const agentPolicies = (config.agents as Array<Record<string, unknown>>) ?? [];
    const agentPolicy = agentPolicies.find(
      (a) => a.agentId === agentIdFilter,
    );

    if (!agentPolicy) {
      return NextResponse.json(
        { error: `No policy found for agentId '${agentIdFilter}'` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      version: data.version ?? config.version,
      defaultAction: config.defaultAction,
      agent: agentPolicy,
    });
  }

  return NextResponse.json({
    version: data.version ?? config.version,
    defaultAction: config.defaultAction,
    agents: config.agents ?? [],
  });
}
