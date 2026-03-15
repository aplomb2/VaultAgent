#!/usr/bin/env node

/**
 * VaultAgent MCP Proxy — entry point.
 *
 * Wraps any MCP server with VaultAgent permission checks. Usage:
 *
 *   vaultagent-mcp --policy vaultagent.policy.yaml -- npx some-mcp-server
 *
 * The proxy reads stdio from the downstream client, enforces the policy,
 * and forwards permitted calls to the upstream server it spawns.
 */

import { resolve } from "node:path";
import { VaultAgentProxy } from "./proxy.js";

// ── CLI argument parsing ─────────────────────────────────────────────────────

interface CliArgs {
  policyPath: string;
  auditPath: string;
  cloudEndpoint?: string;
  cloudApiKey?: string;
  agentId?: string;
  upstreamCommand: string;
  upstreamArgs: string[];
}

function printUsage(): void {
  const usage = `
Usage: vaultagent-mcp [options] -- <upstream-command> [upstream-args...]

Options:
  --policy <path>     Path to vaultagent.policy.yaml (default: ./vaultagent.policy.yaml)
  --audit <path>      Path to audit log file (default: ./vaultagent-mcp-audit.jsonl)
  --cloud-endpoint    VaultAgent Cloud API endpoint for remote reporting
  --cloud-api-key     VaultAgent Cloud API key
  --agent-id          Identifier for this agent session
  -h, --help          Show this help message

Examples:
  vaultagent-mcp -- npx @modelcontextprotocol/server-filesystem /tmp
  vaultagent-mcp --policy strict.yaml -- node my-mcp-server.js
`.trim();

  process.stderr.write(usage + "\n");
}

function parseArgs(argv: string[]): CliArgs {
  let policyPath = "./vaultagent.policy.yaml";
  let auditPath = "./vaultagent-mcp-audit.jsonl";
  let cloudEndpoint: string | undefined;
  let cloudApiKey: string | undefined;
  let agentId: string | undefined;

  // Find the "--" separator.
  const separatorIndex = argv.indexOf("--");
  if (separatorIndex === -1) {
    process.stderr.write(
      "Error: Missing '--' separator before upstream command.\n\n",
    );
    printUsage();
    process.exit(1);
  }

  const proxyArgs = argv.slice(0, separatorIndex);
  const upstreamParts = argv.slice(separatorIndex + 1);

  if (upstreamParts.length === 0) {
    process.stderr.write("Error: No upstream command specified.\n\n");
    printUsage();
    process.exit(1);
  }

  // Parse proxy-specific flags.
  for (let i = 0; i < proxyArgs.length; i++) {
    const arg = proxyArgs[i];
    const next = proxyArgs[i + 1];

    switch (arg) {
      case "--policy":
        if (!next) {
          process.stderr.write("Error: --policy requires a path argument.\n");
          process.exit(1);
        }
        policyPath = next;
        i++;
        break;
      case "--audit":
        if (!next) {
          process.stderr.write("Error: --audit requires a path argument.\n");
          process.exit(1);
        }
        auditPath = next;
        i++;
        break;
      case "--cloud-endpoint":
        if (!next) {
          process.stderr.write(
            "Error: --cloud-endpoint requires a URL argument.\n",
          );
          process.exit(1);
        }
        cloudEndpoint = next;
        i++;
        break;
      case "--cloud-api-key":
        if (!next) {
          process.stderr.write(
            "Error: --cloud-api-key requires a key argument.\n",
          );
          process.exit(1);
        }
        cloudApiKey = next;
        i++;
        break;
      case "--agent-id":
        if (!next) {
          process.stderr.write(
            "Error: --agent-id requires an identifier argument.\n",
          );
          process.exit(1);
        }
        agentId = next;
        i++;
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
        break;
      default:
        process.stderr.write(`Error: Unknown option "${arg}".\n\n`);
        printUsage();
        process.exit(1);
    }
  }

  const [upstreamCommand, ...upstreamArgs] = upstreamParts;

  return {
    policyPath: resolve(policyPath),
    auditPath: resolve(auditPath),
    cloudEndpoint,
    cloudApiKey,
    agentId,
    upstreamCommand,
    upstreamArgs,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const proxy = new VaultAgentProxy({
    upstreamCommand: args.upstreamCommand,
    upstreamArgs: args.upstreamArgs,
    policyPath: args.policyPath,
    auditPath: args.auditPath,
    cloudEndpoint: args.cloudEndpoint,
    cloudApiKey: args.cloudApiKey,
    agentId: args.agentId,
  });

  // Graceful shutdown on SIGINT / SIGTERM.
  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(
      `\n[vaultagent-mcp] Received ${signal}, shutting down...\n`,
    );
    try {
      await proxy.stop();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[vaultagent-mcp] Error during shutdown: ${message}\n`,
      );
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await proxy.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[vaultagent-mcp] Fatal error: ${message}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`[vaultagent-mcp] Unhandled error: ${err}\n`);
  process.exit(1);
});
