"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  Filter,
} from "lucide-react";
import clsx from "clsx";
import type { AuditLogEntry } from "@/lib/types";
import { getAuditLogs, getAgents, getAgentName } from "@/lib/store";
import type { AuditLogFilters } from "@/lib/store";

type SortField = "timestamp" | "agentId" | "tool" | "action" | "latencyMs";
type SortDirection = "asc" | "desc";

const actionColors: Record<string, string> = {
  allow: "bg-emerald-500/20 text-emerald-400",
  deny: "bg-red-500/20 text-red-400",
  require_approval: "bg-amber-500/20 text-amber-400",
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

  // Fetch and sort logs
  const logs = useMemo(() => {
    const fetched = getAuditLogs(filters);
    return fetched.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filters, sortField, sortDir]);

  // Toggle sort column
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  // Sort indicator component
  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5" />
    );
  }

  // Export functionality
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
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-400">Filters</span>
        </div>

        {/* Agent filter */}
        <select
          value={filters.agentId ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, agentId: e.target.value || undefined })
          }
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Action filter */}
        <select
          value={filters.action ?? ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              action: (e.target.value as AuditLogEntry["action"]) || undefined,
            })
          }
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">All Actions</option>
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
          <option value="require_approval">Require Approval</option>
        </select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tools, reasons..."
            value={filters.search ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value || undefined })
            }
            className="rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-9 pr-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* Export buttons */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => exportData("csv")}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => exportData("json")}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">{logs.length} entries</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-slate-200"
                onClick={() => toggleSort("timestamp")}
              >
                Timestamp <SortIndicator field="timestamp" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-slate-200"
                onClick={() => toggleSort("agentId")}
              >
                Agent <SortIndicator field="agentId" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-slate-200"
                onClick={() => toggleSort("tool")}
              >
                Tool <SortIndicator field="tool" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-slate-200"
                onClick={() => toggleSort("action")}
              >
                Action <SortIndicator field="action" />
              </th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-slate-200"
                onClick={() => toggleSort("latencyMs")}
              >
                Latency <SortIndicator field="latencyMs" />
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 100).map((log) => (
              <tr
                key={log.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30"
              >
                <td className="px-4 py-2.5 text-slate-300">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-4 py-2.5 text-slate-300">
                  {getAgentName(log.agentId)}
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-300">
                  {log.tool}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      actionColors[log.action]
                    )}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 text-slate-400">
                  {log.denialReason ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {log.latencyMs != null ? `${log.latencyMs}ms` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
