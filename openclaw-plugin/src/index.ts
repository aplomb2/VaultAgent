/**
 * VaultAgent OpenClaw Plugin — entry point.
 *
 * Integrates VaultAgent permission enforcement into OpenClaw's
 * tool call lifecycle via beforeToolCall hooks.
 *
 * Usage:
 *   import { activate, deactivate, getStatus } from "@vaultagent/openclaw-plugin";
 *
 *   await activate({
 *     policyPath: "./vaultagent.policy.yaml",
 *     agentId: "openclaw",
 *   });
 */

import { PolicyLoader } from "@vaultagent/mcp-proxy/policy";
import { AuditLogger } from "@vaultagent/mcp-proxy/audit";
import {
  beforeToolCall,
  afterToolCall,
  getToolStatuses,
  type HookResult,
  type ToolStatus,
} from "./hooks.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Configuration for the VaultAgent OpenClaw plugin. */
export interface PluginConfig {
  /** Path to the VaultAgent policy YAML file. */
  policyPath: string;
  /** Path to the local audit log file. */
  auditPath?: string;
  /** VaultAgent Cloud API endpoint for remote audit reporting. */
  cloudEndpoint?: string;
  /** API key for VaultAgent Cloud. */
  cloudApiKey?: string;
  /** Identifier for this agent session. */
  agentId?: string;
}

// ── Plugin state ─────────────────────────────────────────────────────────────

let policyLoader: PolicyLoader | undefined;
let auditLogger: AuditLogger | undefined;
let pluginConfig: PluginConfig | undefined;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Activate the VaultAgent plugin.
 *
 * Loads the policy file, initializes the audit logger, and starts
 * watching for policy changes. After activation, use `handleBeforeToolCall`
 * to intercept tool calls.
 */
export async function activate(config: PluginConfig): Promise<void> {
  pluginConfig = config;

  policyLoader = new PolicyLoader(config.policyPath);
  await policyLoader.load();
  policyLoader.startWatching();

  auditLogger = new AuditLogger({
    filePath: config.auditPath,
    cloudEndpoint: config.cloudEndpoint,
    cloudApiKey: config.cloudApiKey,
  });
  await auditLogger.init();

  process.stderr.write(
    `[vaultagent-plugin] Activated — policy: ${config.policyPath}\n`,
  );
}

/**
 * Deactivate the VaultAgent plugin.
 *
 * Stops policy watching and flushes audit logs.
 */
export async function deactivate(): Promise<void> {
  if (policyLoader) {
    policyLoader.stopWatching();
    policyLoader = undefined;
  }

  if (auditLogger) {
    await auditLogger.close();
    auditLogger = undefined;
  }

  pluginConfig = undefined;

  process.stderr.write("[vaultagent-plugin] Deactivated\n");
}

/**
 * Hook to call before a tool is executed.
 *
 * Returns a HookResult indicating whether the call should proceed.
 * If `allowed` is false, the caller should block execution and
 * return the `message` to the agent.
 */
export async function handleBeforeToolCall(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<HookResult> {
  if (!policyLoader || !auditLogger) {
    return {
      allowed: true,
      decision: "allow",
      message: "[VaultAgent] Plugin not activated — allowing call",
      matchedRule: "none",
    };
  }

  return beforeToolCall(
    toolName,
    args,
    policyLoader,
    auditLogger,
    pluginConfig?.agentId,
  );
}

/**
 * Hook to call after a tool has executed (for duration tracking).
 */
export async function handleAfterToolCall(
  toolName: string,
  args: Record<string, unknown>,
  durationMs: number,
  error?: string,
): Promise<void> {
  if (!auditLogger) {
    return;
  }

  await afterToolCall(
    toolName,
    args,
    durationMs,
    error,
    auditLogger,
    pluginConfig?.agentId,
  );
}

/**
 * Query which tools are allowed, denied, or require approval.
 *
 * Pass a list of tool names to check their policy status. Useful
 * for agent introspection.
 */
export function getStatus(toolNames: string[]): ToolStatus[] {
  if (!policyLoader) {
    return toolNames.map((tool) => ({
      tool,
      decision: "allow" as const,
      matchedRule: "none",
    }));
  }

  return getToolStatuses(toolNames, policyLoader);
}

// Re-export types for consumers.
export type { HookResult, ToolStatus } from "./hooks.js";
