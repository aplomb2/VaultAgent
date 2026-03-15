"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";
import type { AuditLogEntry } from "@/lib/types";
import { getAuditLogs, getAgents, getAgentName } from "@/lib/store";
import type { AuditLogFilters } from "@/lib/store";

type SortField = "timestamp" | "agentId" | "tool" | "action" | "latencyMs";
type SortDirection = "asc" | "desc";

const actionBadge: Record<string, string> = {
  allow: "bg-emerald-500/10 text-emerald-400",
  deny: "bg-red-500/10 text-red-400",
  require_approval: "bg-amber-500/10 text-amber-400",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AuditLogTable() {
  const agents = getAgents();

  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const logs = useMemo(() => {
    const fetched = getAuditLogs(filters);
    return fetched.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filters, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ChevronDown className="inline h-3 w-3 opacity-0 group-hover:opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3 text-emerald-400" />
    ) : (
      <ChevronDown className="inline h-3 w-3 text-emerald-400" />
    );
  }

  function exportData(format: "csv" | "json") {
    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === "csv") {
      const headers = [
        "Timestamp",
        "Agent",
        "Tool",
        "Action",
        "Reason",
        "Latency (ms)",
      ];
      const rows = logs.map((l) => [
        l.timestamp,
        getAgentName(l.agentId),
        l.tool,
        l.action,
        l.denialReason ?? "",
        String(l.latencyMs ?? ""),
      ]);
      content = [headers, ...rows].map((r) => r.join(",")).join("\n");
      mimeType = "text/csv";
      extension = "csv";
    } else {
      content = JSON.stringify(logs, null, 2);
      mimeType = "application/json";
      extension = "json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>

        <select
          value={filters.agentId ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, agentId: e.target.value || undefined })
          }
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 outline-none transition-colors focus:border-emerald-500/50"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filters.action ?? ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              action: (e.target.value as AuditLogEntry["action"]) || undefined,
            })
          }
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 outline-none transition-colors focus:border-emerald-500/50"
        >
          <option value="">All Actions</option>
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
          <option value="require_approval">Require Approval</option>
        </select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tools, reasons..."
            value={filters.search ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value || undefined })
            }
            className="rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-xs text-slate-300 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500/50"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-600">{logs.length} entries</span>
          <button
            onClick={() => exportData("csv")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
          <button
            onClick={() => exportData("json")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
          >
            <Download className="h-3 w-3" />
            JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              {(
                [
                  ["timestamp", "Timestamp"],
                  ["agentId", "Agent"],
                  ["tool", "Tool"],
                  ["action", "Action"],
                ] as [SortField, string][]
              ).map(([field, label]) => (
                <th
                  key={field}
                  className="group cursor-pointer px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                  onClick={() => toggleSort(field)}
                >
                  {label} <SortIcon field={field} />
                </th>
              ))}
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Reason
              </th>
              <th
                className="group cursor-pointer px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                onClick={() => toggleSort("latencyMs")}
              >
                Latency <SortIcon field="latencyMs" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.slice(0, 100).map((log) => (
              <tr
                key={log.id}
                className="transition-colors hover:bg-slate-800/50"
              >
                <td className="px-5 py-2.5 text-xs text-slate-400">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-5 py-2.5 text-xs text-slate-300">
                  {getAgentName(log.agentId)}
                </td>
                <td className="px-5 py-2.5 font-mono text-xs text-slate-300">
                  {log.tool}
                </td>
                <td className="px-5 py-2.5">
                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      actionBadge[log.action]
                    )}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="max-w-[200px] truncate px-5 py-2.5 text-xs text-slate-500">
                  {log.denialReason ?? "\u2014"}
                </td>
                <td className="px-5 py-2.5 font-mono text-xs text-slate-500">
                  {log.latencyMs != null ? `${log.latencyMs}ms` : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
