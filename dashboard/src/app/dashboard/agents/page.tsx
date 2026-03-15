"use client";

import { useState } from "react";
import {
  Bot,
  Plus,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { Agent } from "@/lib/types";
import { getAgents, addAgent } from "@/lib/store";

const statusBadge: Record<Agent["status"], string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
};

// Mask an API key, showing only the prefix and last 4 characters
function maskKey(key: string): string {
  if (key.length <= 10) return key;
  return key.slice(0, 6) + "..." + key.slice(-4);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(getAgents());
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Register a new agent
  function handleRegister() {
    if (!newName.trim()) return;
    const agent = addAgent(newName.trim());
    setAgents([...getAgents()]);
    setNewName("");
    setShowForm(false);
    // Auto-reveal the new agent's key so the user can copy it
    setRevealedKeys((prev) => new Set(prev).add(agent.id));
  }

  // Toggle API key visibility
  function toggleKeyVisibility(id: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Copy key to clipboard
  async function copyKey(agent: Agent) {
    await navigator.clipboard.writeText(agent.apiKey);
    setCopiedId(agent.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Simulate API key regeneration
  function regenerateKey(agentId: string) {
    // In a real app this would call the backend
    const newKey = `va_sk_${Array.from({ length: 20 }, () =>
      "abcdefghijklmnopqrstuvwxyz0123456789".charAt(
        Math.floor(Math.random() * 36)
      )
    ).join("")}`;
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, apiKey: newKey } : a))
    );
    setRevealedKeys((prev) => new Set(prev).add(agentId));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Agents</h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage registered agents and their API keys
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Register Agent
        </button>
      </div>

      {/* Registration form */}
      {showForm && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">
              Register New Agent
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md p-1 text-slate-400 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              placeholder="Agent name (e.g., CodeAssistant)"
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button
              onClick={handleRegister}
              disabled={!newName.trim()}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Register
            </button>
          </div>
        </div>
      )}

      {/* Agents table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">API Key</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
              <th className="px-4 py-3 font-medium">Total Calls</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30"
              >
                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-slate-200">
                      {agent.name}
                    </span>
                  </div>
                </td>

                {/* Status badge */}
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      statusBadge[agent.status]
                    )}
                  >
                    {agent.status}
                  </span>
                </td>

                {/* API Key */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">
                      {revealedKeys.has(agent.id)
                        ? agent.apiKey
                        : maskKey(agent.apiKey)}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(agent.id)}
                      className="rounded p-1 text-slate-500 hover:text-slate-300"
                      title={
                        revealedKeys.has(agent.id) ? "Hide key" : "Show key"
                      }
                    >
                      {revealedKeys.has(agent.id) ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => copyKey(agent)}
                      className="rounded p-1 text-slate-500 hover:text-slate-300"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {copiedId === agent.id && (
                      <span className="text-xs text-emerald-400">Copied!</span>
                    )}
                  </div>
                </td>

                {/* Last Seen */}
                <td className="px-4 py-3 text-slate-400">
                  {formatDate(agent.lastSeen)}
                </td>

                {/* Total Calls */}
                <td className="px-4 py-3 text-slate-300">
                  {agent.totalCalls.toLocaleString()}
                  {agent.deniedCalls > 0 && (
                    <span className="ml-1 text-xs text-red-400">
                      ({agent.deniedCalls} denied)
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => regenerateKey(agent.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    title="Regenerate API key"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
