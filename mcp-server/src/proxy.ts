/**
 * VaultAgent MCP proxy server.
 *
 * Sits between an MCP client and an upstream MCP server, intercepting
 * tool calls to enforce policy decisions and record audit events. All
 * other protocol traffic (resources, prompts, list_tools) is forwarded
 * transparently.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { PolicyLoader, type PolicyResult } from "./policy.js";
import { AuditLogger, type AuditEvent } from "./audit.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Options for constructing the VaultAgentProxy. */
export interface VaultAgentProxyOptions {
  /** Shell command (with args) to spawn the upstream MCP server. */
  upstreamCommand: string;
  /** Arguments to pass to the upstream command. */
  upstreamArgs: string[];
  /** Path to the VaultAgent policy YAML file. */
  policyPath: string;
  /** Path to the audit log file. */
  auditPath?: string;
  /** Optional VaultAgent Cloud endpoint for remote audit reporting. */
  cloudEndpoint?: string;
  /** Optional API key for VaultAgent Cloud. */
  cloudApiKey?: string;
  /** Optional identifier for the agent/session. */
  agentId?: string;
}

// ── VaultAgentProxy ──────────────────────────────────────────────────────────

export class VaultAgentProxy {
  private readonly options: VaultAgentProxyOptions;
  private readonly policyLoader: PolicyLoader;
  private readonly auditLogger: AuditLogger;
  private readonly server: Server;
  private client: Client | undefined;
  private clientTransport: StdioClientTransport | undefined;

  constructor(options: VaultAgentProxyOptions) {
    this.options = options;

    this.policyLoader = new PolicyLoader(options.policyPath);

    this.auditLogger = new AuditLogger({
      filePath: options.auditPath,
      cloudEndpoint: options.cloudEndpoint,
      cloudApiKey: options.cloudApiKey,
    });

    this.server = new Server(
      {
        name: "vaultagent-mcp-proxy",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    this.registerHandlers();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Start the proxy: load policy, connect to upstream, then serve clients. */
  async start(): Promise<void> {
    // Load policy first so we fail fast if it's invalid.
    await this.policyLoader.load();
    this.policyLoader.startWatching();

    // Initialize audit logging.
    await this.auditLogger.init();

    // Connect to the upstream MCP server.
    await this.connectUpstream();

    // Start serving clients over stdio.
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    process.stderr.write(
      `[vaultagent-mcp] Proxy started — upstream: ${this.options.upstreamCommand}\n`,
    );
  }

  /** Gracefully shut down the proxy, flushing audit logs. */
  async stop(): Promise<void> {
    this.policyLoader.stopWatching();

    // Close the upstream client connection.
    if (this.client) {
      await this.client.close();
    }

    // Flush and close audit logs.
    await this.auditLogger.close();

    // Close the server.
    await this.server.close();

    process.stderr.write("[vaultagent-mcp] Proxy stopped\n");
  }

  // ── Upstream connection ──────────────────────────────────────────────────

  /** Spawn the upstream MCP server and connect as a client. */
  private async connectUpstream(): Promise<void> {
    this.clientTransport = new StdioClientTransport({
      command: this.options.upstreamCommand,
      args: this.options.upstreamArgs,
    });

    this.client = new Client(
      {
        name: "vaultagent-mcp-proxy-client",
        version: "0.1.0",
      },
      {
        capabilities: {},
      },
    );

    await this.client.connect(this.clientTransport);

    process.stderr.write(
      "[vaultagent-mcp] Connected to upstream MCP server\n",
    );
  }

  // ── Handler registration ─────────────────────────────────────────────────

  /** Wire up MCP request handlers on the server. */
  private registerHandlers(): void {
    this.registerToolHandlers();
    this.registerResourceHandlers();
    this.registerPromptHandlers();
  }

  // ── Tool handlers ────────────────────────────────────────────────────────

  private registerToolHandlers(): void {
    // Forward tool listing from upstream.
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.client) {
        return { tools: [] };
      }
      return this.client.listTools();
    });

    // Intercept tool calls with policy checks.
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const toolName = request.params.name;
        const args = (request.params.arguments ?? {}) as Record<
          string,
          unknown
        >;

        // Evaluate policy.
        const policyResult: PolicyResult = this.policyLoader.evaluate(
          toolName,
          args,
        );

        // Build the base audit event.
        const baseEvent: Omit<AuditEvent, "durationMs" | "error"> = {
          timestamp: new Date().toISOString(),
          tool: toolName,
          decision: policyResult.decision,
          argsHash: AuditLogger.hashArgs(args),
          agentId: this.options.agentId,
        };

        // Handle deny immediately.
        if (policyResult.decision === "deny") {
          await this.auditLogger.log({ ...baseEvent });
          return {
            content: [
              {
                type: "text" as const,
                text: `[VaultAgent] Tool call denied by policy (matched rule: "${policyResult.matchedRule}")`,
              },
            ],
            isError: true,
          };
        }

        // Handle require_approval (deny for now — approval flow is a future feature).
        if (policyResult.decision === "require_approval") {
          await this.auditLogger.log({ ...baseEvent });
          return {
            content: [
              {
                type: "text" as const,
                text: `[VaultAgent] Tool call requires approval (matched rule: "${policyResult.matchedRule}"). Approval flow is not yet implemented.`,
              },
            ],
            isError: true,
          };
        }

        // Forward the call to upstream.
        if (!this.client) {
          await this.auditLogger.log({
            ...baseEvent,
            error: "No upstream connection",
          });
          return {
            content: [
              {
                type: "text" as const,
                text: "[VaultAgent] Upstream MCP server is not connected",
              },
            ],
            isError: true,
          };
        }

        const startTime = performance.now();

        try {
          const result = await this.client.callTool({
            name: toolName,
            arguments: args,
          });

          const durationMs = Math.round(performance.now() - startTime);
          await this.auditLogger.log({ ...baseEvent, durationMs });

          return result;
        } catch (err) {
          const durationMs = Math.round(performance.now() - startTime);
          const message = err instanceof Error ? err.message : String(err);

          await this.auditLogger.log({
            ...baseEvent,
            durationMs,
            error: message,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: `[VaultAgent] Upstream tool call failed: ${message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  // ── Resource handlers (transparent pass-through) ─────────────────────────

  private registerResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      if (!this.client) {
        return { resources: [] };
      }
      return this.client.listResources();
    });

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        if (!this.client) {
          throw new Error("Upstream MCP server is not connected");
        }
        return this.client.readResource({
          uri: request.params.uri,
        });
      },
    );
  }

  // ── Prompt handlers (transparent pass-through) ───────────────────────────

  private registerPromptHandlers(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      if (!this.client) {
        return { prompts: [] };
      }
      return this.client.listPrompts();
    });

    this.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request) => {
        if (!this.client) {
          throw new Error("Upstream MCP server is not connected");
        }
        return this.client.getPrompt({
          name: request.params.name,
          arguments: request.params.arguments,
        });
      },
    );
  }
}
