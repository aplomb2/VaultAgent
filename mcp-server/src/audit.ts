/**
 * Audit logger for VaultAgent MCP proxy.
 *
 * Records every tool invocation decision to a local JSONL file and
 * optionally reports to VaultAgent Cloud API.
 */

import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

// ── Types ────────────────────────────────────────────────────────────────────

/** A single audit log entry. */
export interface AuditEvent {
  /** ISO-8601 timestamp of the event. */
  timestamp: string;
  /** Name of the MCP tool that was invoked. */
  tool: string;
  /** Policy decision: allow, deny, or require_approval. */
  decision: "allow" | "deny" | "require_approval";
  /** SHA-256 hash of the serialized arguments (privacy-preserving). */
  argsHash: string;
  /** Optional identifier for the calling agent / session. */
  agentId?: string;
  /** Optional upstream request id for correlation. */
  requestId?: string;
  /** Duration in milliseconds of the upstream call (only when forwarded). */
  durationMs?: number;
  /** Error message if the upstream call failed. */
  error?: string;
}

/** Configuration for the audit logger. */
export interface AuditLoggerOptions {
  /** Path to the JSONL audit file. */
  filePath?: string;
  /** VaultAgent Cloud API endpoint for remote reporting. */
  cloudEndpoint?: string;
  /** API key for VaultAgent Cloud. */
  cloudApiKey?: string;
  /** Maximum events to buffer before flushing to cloud. */
  bufferSize?: number;
  /** Maximum milliseconds between cloud flushes. */
  flushIntervalMs?: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FILE_PATH = "vaultagent-mcp-audit.jsonl";
const DEFAULT_BUFFER_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 10_000;

// ── AuditLogger ──────────────────────────────────────────────────────────────

export class AuditLogger {
  private readonly filePath: string;
  private readonly cloudEndpoint: string | undefined;
  private readonly cloudApiKey: string | undefined;
  private readonly bufferSize: number;
  private readonly flushIntervalMs: number;

  private stream: WriteStream | undefined;
  private cloudBuffer: AuditEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private closed = false;

  constructor(options: AuditLoggerOptions = {}) {
    this.filePath = options.filePath ?? DEFAULT_FILE_PATH;
    this.cloudEndpoint = options.cloudEndpoint;
    this.cloudApiKey = options.cloudApiKey;
    this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Initialize the logger: open the local file stream and start the cloud
   * flush timer (if cloud reporting is configured).
   */
  async init(): Promise<void> {
    await mkdir(dirname(this.filePath) || ".", { recursive: true });
    this.stream = createWriteStream(this.filePath, { flags: "a" });

    if (this.cloudEndpoint && this.cloudApiKey) {
      this.flushTimer = setInterval(() => {
        void this.flushToCloud();
      }, this.flushIntervalMs);
      // Allow the process to exit even if the timer is still running.
      this.flushTimer.unref();
    }
  }

  /**
   * Record an audit event.
   *
   * The event is written to the local JSONL file immediately and buffered
   * for cloud reporting when configured.
   */
  async log(event: AuditEvent): Promise<void> {
    if (this.closed) {
      return;
    }

    // Write to local file.
    this.writeToFile(event);

    // Buffer for cloud reporting.
    if (this.cloudEndpoint && this.cloudApiKey) {
      this.cloudBuffer.push(event);
      if (this.cloudBuffer.length >= this.bufferSize) {
        await this.flushToCloud();
      }
    }
  }

  /**
   * Flush any buffered events and close the logger.
   *
   * Always call this before process exit to avoid losing buffered events.
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final cloud flush.
    await this.flushToCloud();

    // Close the file stream.
    await new Promise<void>((resolve, reject) => {
      if (!this.stream) {
        resolve();
        return;
      }
      this.stream.end((err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Compute a SHA-256 hash of tool arguments for privacy-preserving logging.
   */
  static hashArgs(args: Record<string, unknown> | undefined): string {
    if (!args || Object.keys(args).length === 0) {
      return "empty";
    }
    const serialized = JSON.stringify(args, Object.keys(args).sort());
    return createHash("sha256").update(serialized).digest("hex");
  }

  /** Append a single event line to the JSONL file. */
  private writeToFile(event: AuditEvent): void {
    if (!this.stream) {
      return;
    }
    const line = JSON.stringify(event) + "\n";
    this.stream.write(line, (err) => {
      if (err) {
        process.stderr.write(
          `[vaultagent-mcp] Failed to write audit log: ${err.message}\n`,
        );
      }
    });
  }

  /** Send buffered events to VaultAgent Cloud API. */
  private async flushToCloud(): Promise<void> {
    if (
      this.cloudBuffer.length === 0 ||
      !this.cloudEndpoint ||
      !this.cloudApiKey
    ) {
      return;
    }

    const batch = this.cloudBuffer.splice(0, this.cloudBuffer.length);

    try {
      const response = await fetch(this.cloudEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cloudApiKey}`,
        },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        // Put events back so they are retried on the next flush.
        this.cloudBuffer.unshift(...batch);
        process.stderr.write(
          `[vaultagent-mcp] Cloud reporting failed: HTTP ${response.status}\n`,
        );
      }
    } catch (err) {
      // Network failure — re-queue for retry.
      this.cloudBuffer.unshift(...batch);
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[vaultagent-mcp] Cloud reporting error: ${message}\n`,
      );
    }
  }
}
