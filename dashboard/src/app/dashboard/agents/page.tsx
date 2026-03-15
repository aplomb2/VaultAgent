"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Bot,
  Plus,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  Check,
} from "lucide-react";
import clsx from "clsx";
import type { Agent } from "@/lib/types";
import { getAgents, addAgent } from "@/lib/store";
import { getDemoAgents } from "@/lib/demo-data";

const statusBadge: Record<Agent["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  inactive: "bg-slate-500/10 text-slate-400",
  suspended: "bg-red-500/10 text-red-400",
};

function maskKey(key: string): string {
  if (key.length <= 10) return key;
  return key.slice(0, 6) + "\u2022".repeat(8) + key.slice(-4);
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
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const data = await getAgents(userId);
      if (data.length === 0) {
        setAgents(getDemoAgents());
        setIsDemo(true);
      } else {
        setAgents(data);
        setIsDemo(false);
      }
      setLoading(false);
    }

    load();
  }, [userId]);

  async function handleRegister() {
    if (!newName.trim() || !userId) return;
    try {
      const agent = await addAgent(userId, newName.trim());
      setAgents((prev) => [agent, ...prev]);
      setNewName("");
      setShowForm(false);
      setRevealedKeys((prev) => new Set(prev).add(agent.id));
      setIsDemo(false);
    } catch (err) {
      console.error("Failed to register agent:", err);
    }
  }

  function toggleKeyVisibility(id: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyKey(agent: Agent) {
    await navigator.clipboard.writeText(agent.apiKey);
    setCopiedId(agent.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-800/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      {isDemo && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          Demo data — register an agent to see your real data
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Agents</h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage registered agents and API keys
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Register Agent
        </button>
      </div>

      {/* Registration form */}
      {showForm && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Register New Agent
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              placeholder="Agent name (e.g. CodeAssistant)"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25"
            />
            <button
              onClick={handleRegister}
              disabled={!newName.trim()}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Register
            </button>
          </div>
        </div>
      )}

      {/* Agents table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Agent
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                API Key
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Last Seen
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Calls
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="transition-colors hover:bg-slate-800/50"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                      <Bot className="h-4 w-4 text-slate-400" />
                    </div>
                    <span className="font-medium text-white">
                      {agent.name}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusBadge[agent.status]
                    )}
                  >
                    {agent.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <code className="rounded-md bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-400">
                      {revealedKeys.has(agent.id)
                        ? agent.apiKey
                        : maskKey(agent.apiKey)}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(agent.id)}
                      className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
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
                      className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                      title="Copy to clipboard"
                    >
                      {copiedId === agent.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-400">
                  {formatDate(agent.lastSeen)}
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-slate-300">
                    {agent.totalCalls.toLocaleString()}
                  </span>
                  {agent.deniedCalls > 0 && (
                    <span className="ml-1.5 text-xs text-red-400/80">
                      {agent.deniedCalls} denied
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  {/* Regenerate removed — keys are managed in DB */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
