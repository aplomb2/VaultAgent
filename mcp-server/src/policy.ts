/**
 * Policy loader and evaluator for VaultAgent MCP proxy.
 *
 * Reads a YAML policy file, watches it for changes, and evaluates tool
 * invocations against the declared rules.
 */

import { readFile, watch } from "node:fs/promises";
import yaml from "js-yaml";

// ── Types ────────────────────────────────────────────────────────────────────

/** The decision returned by the policy engine for a given tool call. */
export type PolicyDecision = "allow" | "deny" | "require_approval";

/** Result of a policy evaluation including the matched rule (if any). */
export interface PolicyResult {
  decision: PolicyDecision;
  /** The rule pattern that matched, or "default" if no rule matched. */
  matchedRule: string;
}

/** A single rule inside the policy file. */
export interface PolicyRule {
  /** Glob pattern matched against tool names (e.g. "fs_*", "exec_command"). */
  pattern: string;
  /** Decision to apply when the pattern matches. */
  decision: PolicyDecision;
  /** Optional list of argument constraints (key-value regex pairs). */
  argConstraints?: Record<string, string>;
}

/** Top-level structure of the vaultagent.policy.yaml file. */
export interface PolicyFile {
  /** Schema version for forward compatibility. */
  version: number;
  /** Default decision when no rule matches. */
  defaultDecision: PolicyDecision;
  /** Ordered list of rules evaluated top-to-bottom (first match wins). */
  rules: PolicyRule[];
}

// ── Glob matching ────────────────────────────────────────────────────────────

/**
 * Minimal glob matcher supporting `*` (any chars) and `?` (single char).
 *
 * This avoids pulling in a full minimatch dependency while covering the
 * patterns commonly used in policy files (e.g. "fs_*", "exec_*", "db_query").
 */
function globMatch(pattern: string, value: string): boolean {
  // Escape regex special chars except our glob wildcards.
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`).test(value);
}

// ── PolicyLoader ─────────────────────────────────────────────────────────────

export class PolicyLoader {
  private policy: PolicyFile;
  private readonly filePath: string;
  private watchAbort: AbortController | undefined;

  constructor(filePath: string) {
    this.filePath = filePath;
    // Start with a permissive default until the file is loaded.
    this.policy = {
      version: 1,
      defaultDecision: "deny",
      rules: [],
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Load the policy file from disk. Throws if the file cannot be read or
   * parsed.
   */
  async load(): Promise<void> {
    const raw = await readFile(this.filePath, "utf-8");
    this.policy = this.parse(raw);
  }

  /**
   * Start watching the policy file for changes and automatically reload.
   *
   * Errors during reload are logged to stderr but do not crash the proxy;
   * the last successfully loaded policy remains in effect.
   */
  startWatching(): void {
    if (this.watchAbort) {
      return;
    }
    this.watchAbort = new AbortController();

    // Fire-and-forget the async watcher loop.
    void this.watchLoop(this.watchAbort.signal);
  }

  /** Stop watching the policy file. */
  stopWatching(): void {
    if (this.watchAbort) {
      this.watchAbort.abort();
      this.watchAbort = undefined;
    }
  }

  /**
   * Evaluate a tool invocation against the loaded policy.
   *
   * Rules are checked top-to-bottom; the first matching rule wins. If no
   * rule matches, the default decision is returned.
   */
  evaluate(
    toolName: string,
    args?: Record<string, unknown>,
  ): PolicyResult {
    for (const rule of this.policy.rules) {
      if (!globMatch(rule.pattern, toolName)) {
        continue;
      }

      // If the rule has argument constraints, all must match.
      if (rule.argConstraints && args) {
        const constraintsMet = Object.entries(rule.argConstraints).every(
          ([key, regexStr]) => {
            const value = args[key];
            if (value === undefined) {
              return false;
            }
            try {
              return new RegExp(regexStr).test(String(value));
            } catch {
              // Invalid regex in policy — treat as non-matching.
              return false;
            }
          },
        );
        if (!constraintsMet) {
          continue;
        }
      }

      return { decision: rule.decision, matchedRule: rule.pattern };
    }

    return {
      decision: this.policy.defaultDecision,
      matchedRule: "default",
    };
  }

  /** Return a snapshot of the currently loaded policy. */
  getPolicy(): Readonly<PolicyFile> {
    return this.policy;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Parse raw YAML into a validated PolicyFile. */
  private parse(raw: string): PolicyFile {
    const doc = yaml.load(raw) as Record<string, unknown>;

    if (!doc || typeof doc !== "object") {
      throw new Error("Policy file must be a YAML mapping");
    }

    const version = typeof doc.version === "number" ? doc.version : 1;

    const defaultDecision = this.validDecision(
      doc.defaultDecision ?? doc.default_decision,
      "deny",
    );

    const rawRules = Array.isArray(doc.rules) ? doc.rules : [];
    const rules: PolicyRule[] = rawRules.map(
      (r: Record<string, unknown>, i: number) => {
        if (!r.pattern || typeof r.pattern !== "string") {
          throw new Error(`Rule ${i} is missing a valid "pattern" field`);
        }
        return {
          pattern: r.pattern,
          decision: this.validDecision(r.decision, defaultDecision),
          argConstraints:
            r.argConstraints && typeof r.argConstraints === "object"
              ? (r.argConstraints as Record<string, string>)
              : undefined,
        };
      },
    );

    return { version, defaultDecision, rules };
  }

  /** Validate and coerce a decision string. */
  private validDecision(
    value: unknown,
    fallback: PolicyDecision,
  ): PolicyDecision {
    const valid: PolicyDecision[] = ["allow", "deny", "require_approval"];
    if (typeof value === "string" && valid.includes(value as PolicyDecision)) {
      return value as PolicyDecision;
    }
    return fallback;
  }

  /** Internal watcher loop using the Node.js fs.watch async iterator. */
  private async watchLoop(signal: AbortSignal): Promise<void> {
    try {
      const watcher = watch(this.filePath, { signal });
      for await (const event of watcher) {
        if (event.eventType === "change" || event.eventType === "rename") {
          try {
            await this.load();
            process.stderr.write(
              `[vaultagent-mcp] Policy reloaded from ${this.filePath}\n`,
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(
              `[vaultagent-mcp] Failed to reload policy: ${message}\n`,
            );
          }
        }
      }
    } catch (err) {
      // AbortError is expected when we call stopWatching().
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[vaultagent-mcp] Policy watcher error: ${message}\n`,
      );
    }
  }
}
