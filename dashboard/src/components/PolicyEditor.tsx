"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Download, Code, Table } from "lucide-react";
import clsx from "clsx";
import type { PolicyConfig, PolicyRule, AgentPolicy } from "@/lib/types";
import { getPolicies, updatePolicies, getAgents } from "@/lib/store";

type ViewMode = "visual" | "yaml";

// Convert policy config to a YAML-like string representation
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

// Parse YAML-like string back to PolicyConfig (simple parser)
function fromYaml(yaml: string): PolicyConfig | null {
  try {
    // Very basic YAML-like parser for the specific structure
    const config: PolicyConfig = {
      version: "1.0.0",
      defaultAction: "deny",
      agents: [],
    };

    const versionMatch = yaml.match(/version:\s*"([^"]+)"/);
    if (versionMatch) config.version = versionMatch[1];

    const defaultMatch = yaml.match(/defaultAction:\s*"([^"]+)"/);
    if (defaultMatch) config.defaultAction = defaultMatch[1];

    // Parse agents using regex blocks
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
  allow: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  deny: "bg-red-500/20 text-red-400 border-red-500/30",
  require_approval: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function PolicyEditor() {
  const [config, setConfig] = useState<PolicyConfig>(getPolicies());
  const [viewMode, setViewMode] = useState<ViewMode>("visual");
  const [yamlContent, setYamlContent] = useState<string>(toYaml(config));
  const [saveStatus, setSaveStatus] = useState<string>("");

  const agents = getAgents();

  // Handle switching between views
  function switchView(mode: ViewMode) {
    if (mode === "yaml") {
      setYamlContent(toYaml(config));
    } else {
      const parsed = fromYaml(yamlContent);
      if (parsed) {
        setConfig(parsed);
      }
    }
    setViewMode(mode);
  }

  // Update a specific rule
  function updateRule(
    agentIndex: number,
    ruleIndex: number,
    field: keyof PolicyRule,
    value: string
  ) {
    const updated = { ...config };
    const agents = [...updated.agents];
    const agent = { ...agents[agentIndex] };
    const rules = [...agent.rules];
    rules[ruleIndex] = { ...rules[ruleIndex], [field]: value };
    agent.rules = rules;
    agents[agentIndex] = agent;
    updated.agents = agents;
    setConfig(updated);
  }

  // Add a new rule to an agent policy
  function addRule(agentIndex: number) {
    const updated = { ...config };
    const agents = [...updated.agents];
    const agent = { ...agents[agentIndex] };
    agent.rules = [...agent.rules, { tool: "", action: "deny" as const }];
    agents[agentIndex] = agent;
    updated.agents = agents;
    setConfig(updated);
  }

  // Remove a rule from an agent policy
  function removeRule(agentIndex: number, ruleIndex: number) {
    const updated = { ...config };
    const agents = [...updated.agents];
    const agent = { ...agents[agentIndex] };
    agent.rules = agent.rules.filter((_, i) => i !== ruleIndex);
    agents[agentIndex] = agent;
    updated.agents = agents;
    setConfig(updated);
  }

  // Save changes to the store
  function handleSave() {
    if (viewMode === "yaml") {
      const parsed = fromYaml(yamlContent);
      if (!parsed) {
        setSaveStatus("Invalid YAML format");
        return;
      }
      updatePolicies(parsed);
      setConfig(parsed);
    } else {
      updatePolicies(config);
      setYamlContent(toYaml(config));
    }
    setSaveStatus("Saved successfully");
    setTimeout(() => setSaveStatus(""), 2000);
  }

  // Export as YAML file
  function handleExport() {
    const content =
      viewMode === "yaml" ? yamlContent : toYaml(config);
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
        <div className="flex gap-2">
          <button
            onClick={() => switchView("visual")}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              viewMode === "visual"
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-800 text-slate-400 hover:text-slate-300"
            )}
          >
            <Table className="h-4 w-4" />
            Visual Editor
          </button>
          <button
            onClick={() => switchView("yaml")}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              viewMode === "yaml"
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-800 text-slate-400 hover:text-slate-300"
            )}
          >
            <Code className="h-4 w-4" />
            YAML Editor
          </button>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span
              className={clsx(
                "text-sm",
                saveStatus.includes("Invalid")
                  ? "text-red-400"
                  : "text-emerald-400"
              )}
            >
              {saveStatus}
            </span>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>

      {/* YAML Editor */}
      {viewMode === "yaml" && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="h-[600px] w-full resize-none rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            spellCheck={false}
          />
        </div>
      )}

      {/* Visual Editor */}
      {viewMode === "visual" && (
        <div className="space-y-6">
          {/* Global settings */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">
              Global Settings
            </h3>
            <div className="flex gap-6">
              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Version
                </label>
                <input
                  type="text"
                  value={config.version}
                  onChange={(e) =>
                    setConfig({ ...config, version: e.target.value })
                  }
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  Default Action
                </label>
                <select
                  value={config.defaultAction}
                  onChange={(e) =>
                    setConfig({ ...config, defaultAction: e.target.value })
                  }
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="deny">deny</option>
                  <option value="allow">allow</option>
                  <option value="require_approval">require_approval</option>
                </select>
              </div>
            </div>
          </div>

          {/* Per-agent policy tables */}
          {config.agents.map((agentPolicy, agentIndex) => {
            const agentInfo = agents.find(
              (a) => a.id === agentPolicy.agentId
            );
            return (
              <div
                key={agentPolicy.agentId}
                className="rounded-xl border border-slate-700 bg-slate-800 p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">
                      {agentInfo?.name ?? agentPolicy.agentId}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {agentPolicy.description}
                    </p>
                  </div>
                  <button
                    onClick={() => addRule(agentIndex)}
                    className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rule
                  </button>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-sm text-slate-400">
                      <th className="pb-2 font-medium">Tool</th>
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 font-medium">Constraints</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {agentPolicy.rules.map((rule, ruleIndex) => (
                      <tr
                        key={ruleIndex}
                        className="border-b border-slate-700/50"
                      >
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
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                              "rounded-md border px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
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
                        <td className="py-3 pr-4 text-sm text-slate-400">
                          {rule.constraints
                            ? JSON.stringify(rule.constraints)
                            : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() =>
                              removeRule(agentIndex, ruleIndex)
                            }
                            className="rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
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
