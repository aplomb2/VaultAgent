"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Download, Code, Table, Check } from "lucide-react";
import clsx from "clsx";
import type { PolicyConfig, PolicyRule, AgentPolicy, Agent } from "@/lib/types";

type ViewMode = "visual" | "yaml";

// Convert policy config to YAML-like string
function toYaml(config: PolicyConfig): string {
  const lines: string[] = [];
  lines.push(`version: "${config.version}"`);
  lines.push(`defaultAction: "${config.defaultAction}"`);
  lines.push("agents:");

  for (const agent of config.agents) {
    lines.push(`  - agentId: "${agent.agentId}"`);
    lines.push(`    description: "${agent.description}"`);
    lines.push("    rules:");
    for (const rule of agent.rules ?? []) {
      lines.push(`      - tool: "${rule.tool}"`);
      lines.push(`        action: "${rule.action}"`);
      if (rule.constraints && Object.keys(rule.constraints).length > 0) {
        lines.push("        constraints:");
        for (const [key, value] of Object.entries(rule.constraints)) {
          lines.push(`          ${key}: ${JSON.stringify(value)}`);
        }
      }
    }
  }

  return lines.join("\n");
}

// Parse YAML-like string back to PolicyConfig
function fromYaml(yaml: string): PolicyConfig | null {
  try {
    const config: PolicyConfig = {
      version: "1.0.0",
      defaultAction: "deny",
      agents: [],
    };

    const versionMatch = yaml.match(/version:\s*"([^"]+)"/);
    if (versionMatch) config.version = versionMatch[1];

    const defaultMatch = yaml.match(/defaultAction:\s*"([^"]+)"/);
    if (defaultMatch) config.defaultAction = defaultMatch[1];

    const agentBlocks = yaml.split(/\n\s*- agentId:/).slice(1);
    for (const block of agentBlocks) {
      const fullBlock = "- agentId:" + block;
      const agentIdMatch = fullBlock.match(/agentId:\s*"([^"]+)"/);
      const descMatch = fullBlock.match(/description:\s*"([^"]+)"/);

      const agent: AgentPolicy = {
        agentId: agentIdMatch?.[1] ?? "",
        description: descMatch?.[1] ?? "",
        rules: [],
      };

      const ruleMatches = fullBlock.matchAll(
        /- tool:\s*"([^"]+)"\s*\n\s*action:\s*"([^"]+)"/g
      );
      for (const match of ruleMatches) {
        agent.rules.push({
          tool: match[1],
          action: match[2] as PolicyRule["action"],
        });
      }

      config.agents.push(agent);
    }

    return config;
  } catch {
    return null;
  }
}

const actionOptions: PolicyRule["action"][] = [
  "allow",
  "deny",
  "require_approval",
];

const actionBadgeColors: Record<string, string> = {
  allow: "bg-emerald-500/10 text-emerald-400",
  deny: "bg-red-500/10 text-red-400",
  require_approval: "bg-amber-500/10 text-amber-400",
};

interface PolicyEditorProps {
  initialConfig: PolicyConfig;
  agents: Agent[];
  onSave: (config: PolicyConfig) => Promise<void>;
}

export default function PolicyEditor({ initialConfig, agents, onSave }: PolicyEditorProps) {
  const [config, setConfig] = useState<PolicyConfig>(initialConfig);
  const [viewMode, setViewMode] = useState<ViewMode>("visual");
  const [yamlContent, setYamlContent] = useState<string>(toYaml(initialConfig));
  const [saveStatus, setSaveStatus] = useState<string>("");

  function switchView(mode: ViewMode) {
    if (mode === "yaml") {
      setYamlContent(toYaml(config));
    } else {
      const parsed = fromYaml(yamlContent);
      if (parsed) setConfig(parsed);
    }
    setViewMode(mode);
  }

  function updateRule(
    agentIndex: number,
    ruleIndex: number,
    field: keyof PolicyRule,
    value: string
  ) {
    const updated = { ...config };
    const agentsCopy = [...updated.agents];
    const agent = { ...agentsCopy[agentIndex] };
    const rules = [...agent.rules];
    rules[ruleIndex] = { ...rules[ruleIndex], [field]: value };
    agent.rules = rules;
    agentsCopy[agentIndex] = agent;
    updated.agents = agentsCopy;
    setConfig(updated);
  }

  function addRule(agentIndex: number) {
    const updated = { ...config };
    const agentsCopy = [...updated.agents];
    const agent = { ...agentsCopy[agentIndex] };
    agent.rules = [...agent.rules, { tool: "", action: "deny" as const }];
    agentsCopy[agentIndex] = agent;
    updated.agents = agentsCopy;
    setConfig(updated);
  }

  function removeRule(agentIndex: number, ruleIndex: number) {
    const updated = { ...config };
    const agentsCopy = [...updated.agents];
    const agent = { ...agentsCopy[agentIndex] };
    agent.rules = agent.rules.filter((_, i) => i !== ruleIndex);
    agentsCopy[agentIndex] = agent;
    updated.agents = agentsCopy;
    setConfig(updated);
  }

  async function handleSave() {
    let configToSave = config;
    if (viewMode === "yaml") {
      const parsed = fromYaml(yamlContent);
      if (!parsed) {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus(""), 2000);
        return;
      }
      configToSave = parsed;
      setConfig(parsed);
    } else {
      setYamlContent(toYaml(config));
    }

    try {
      await onSave(configToSave);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus(""), 2000);
  }

  function handleExport() {
    const content = viewMode === "yaml" ? yamlContent : toYaml(config);
    const blob = new Blob([content], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaultagent-policy.yaml";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-slate-800 bg-slate-900/50 p-0.5">
          <button
            onClick={() => switchView("visual")}
            className={clsx(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "visual"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            <Table className="h-3.5 w-3.5" />
            Visual
          </button>
          <button
            onClick={() => switchView("yaml")}
            className={clsx(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "yaml"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            <Code className="h-3.5 w-3.5" />
            YAML
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            onClick={handleSave}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-colors",
              saveStatus === "saved"
                ? "bg-emerald-600"
                : saveStatus === "error"
                  ? "bg-red-600"
                  : "bg-emerald-500 hover:bg-emerald-400"
            )}
          >
            {saveStatus === "saved" ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Saved
              </>
            ) : saveStatus === "error" ? (
              "Invalid YAML"
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* YAML editor */}
      {viewMode === "yaml" && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="h-[600px] w-full resize-none bg-transparent p-6 font-mono text-sm text-slate-300 outline-none placeholder:text-slate-600"
            spellCheck={false}
          />
        </div>
      )}

      {/* Visual editor */}
      {viewMode === "visual" && (
        <div className="space-y-6">
          {/* Global settings */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Global Settings
            </h3>
            <div className="flex gap-6">
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Version
                </label>
                <input
                  type="text"
                  value={config.version}
                  onChange={(e) =>
                    setConfig({ ...config, version: e.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Default Action
                </label>
                <select
                  value={config.defaultAction}
                  onChange={(e) =>
                    setConfig({ ...config, defaultAction: e.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25"
                >
                  <option value="deny">deny</option>
                  <option value="allow">allow</option>
                  <option value="require_approval">require_approval</option>
                </select>
              </div>
            </div>
          </div>

          {/* Per-agent policy cards */}
          {config.agents.map((agentPolicy, agentIndex) => {
            const agentInfo = agents.find(
              (a) => a.id === agentPolicy.agentId
            );
            return (
              <div
                key={agentPolicy.agentId}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {agentInfo?.name ?? agentPolicy.agentId}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {agentPolicy.description}
                    </p>
                  </div>
                  <button
                    onClick={() => addRule(agentIndex)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Rule
                  </button>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="pb-2.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        Tool
                      </th>
                      <th className="pb-2.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                      <th className="pb-2.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        Constraints
                      </th>
                      <th className="pb-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {agentPolicy.rules.map((rule, ruleIndex) => (
                      <tr key={ruleIndex}>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            value={rule.tool}
                            onChange={(e) =>
                              updateRule(
                                agentIndex,
                                ruleIndex,
                                "tool",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-sm text-slate-200 outline-none transition-colors focus:border-emerald-500/50"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            value={rule.action}
                            onChange={(e) =>
                              updateRule(
                                agentIndex,
                                ruleIndex,
                                "action",
                                e.target.value
                              )
                            }
                            className={clsx(
                              "rounded-full px-3 py-1.5 text-xs font-medium outline-none",
                              actionBadgeColors[rule.action]
                            )}
                          >
                            {actionOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                          {rule.constraints
                            ? JSON.stringify(rule.constraints)
                            : "\u2014"}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() =>
                              removeRule(agentIndex, ruleIndex)
                            }
                            className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
