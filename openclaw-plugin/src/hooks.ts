/**
 * Tool call interception hooks for the VaultAgent OpenClaw plugin.
 *
 * Evaluates tool calls against the VaultAgent policy and logs audit
 * events. Mirrors the interception logic in mcp-server/src/proxy.ts.
 */

import { PolicyLoader, type PolicyResult } from "@vaultagent/mcp-proxy/policy";
import { AuditLogger, type AuditEvent } from "@vaultagent/mcp-proxy/audit";

// ── Types ────────────────────────────────────────────────────────────────────

/** Result returned by the beforeToolCall hook. */
export interface HookResult {
  /** Whether the tool call should proceed. */
  allowed: boolean;
  /** The policy decision that was made. */
  decision: PolicyResult["decision"];
  /** Human-readable message explaining the decision. */
  message: string;
  /** The policy rule pattern that matched. */
  matchedRule: string;
}

/** Summary of allowed/denied/approval-required tools for introspection. */
export interface ToolStatus {
  tool: string;
  decision: PolicyResult["decision"];
  matchedRule: string;
}

// ── Hook implementation ──────────────────────────────────────────────────────

/**
 * Evaluate a tool call against the VaultAgent policy and log an audit event.
 *
 * Returns a HookResult indicating whether the call should proceed.
 * On deny or require_approval, the caller should block the tool execution
 * and return the message to the agent.
 */
export async function beforeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  policyLoader: PolicyLoader,
  auditLogger: AuditLogger,
  agentId?: string,
): Promise<HookResult> {
  const policyResult: PolicyResult = policyLoader.evaluate(toolName, args);

  const baseEvent: Omit<AuditEvent, "durationMs" | "error"> = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    decision: policyResult.decision,
    argsHash: AuditLogger.hashArgs(args),
    agentId,
  };

  if (policyResult.decision === "deny") {
    await auditLogger.log({ ...baseEvent });
    return {
      allowed: false,
      decision: "deny",
      message: `[VaultAgent] Tool call denied by policy (matched rule: "${policyResult.matchedRule}")`,
      matchedRule: policyResult.matchedRule,
    };
  }

  if (policyResult.decision === "require_approval") {
    await auditLogger.log({ ...baseEvent });
    return {
      allowed: false,
      decision: "require_approval",
      message: `[VaultAgent] Tool call requires approval (matched rule: "${policyResult.matchedRule}"). The call has been paused for human review.`,
      matchedRule: policyResult.matchedRule,
    };
  }

  // Allow — log the event (duration will be recorded by the caller after execution).
  await auditLogger.log({ ...baseEvent });

  return {
    allowed: true,
    decision: "allow",
    message: `[VaultAgent] Tool call allowed (matched rule: "${policyResult.matchedRule}")`,
    matchedRule: policyResult.matchedRule,
  };
}

/**
 * Log an audit event after a tool call completes (for duration tracking).
 */
export async function afterToolCall(
  toolName: string,
  args: Record<string, unknown>,
  durationMs: number,
  error: string | undefined,
  auditLogger: AuditLogger,
  agentId?: string,
): Promise<void> {
  await auditLogger.log({
    timestamp: new Date().toISOString(),
    tool: toolName,
    decision: "allow",
    argsHash: AuditLogger.hashArgs(args),
    agentId,
    durationMs,
    error,
  });
}

/**
 * Query the policy for a list of tools and return their status.
 *
 * Useful for agent introspection — lets the agent know which tools
 * are available, restricted, or blocked.
 */
export function getToolStatuses(
  toolNames: string[],
  policyLoader: PolicyLoader,
): ToolStatus[] {
  return toolNames.map((tool) => {
    const result = policyLoader.evaluate(tool);
    return {
      tool,
      decision: result.decision,
      matchedRule: result.matchedRule,
    };
  });
}
