"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  ShieldAlert,
  ClipboardCheck,
  TrendingUp,
  ShieldX,
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import LiveFeed from "@/components/LiveFeed";
import {
  getStats,
  getAuditLogs,
  getHourlyVolume,
  getAgentNames,
} from "@/lib/store";
import type { Stats, AuditLogEntry } from "@/lib/types";

export default function DashboardOverview() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [stats, setStats] = useState<Stats | null>(null);
  const [hourlyData, setHourlyData] = useState<Array<{ hour: string; allowed: number; denied: number }>>([]);
  const [recentDenied, setRecentDenied] = useState<AuditLogEntry[]>([]);
  const [allLogs, setAllLogs] = useState<AuditLogEntry[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;

    const [s, h, logs, names] = await Promise.all([
      getStats(userId),
      getHourlyVolume(userId),
      getAuditLogs(userId, { action: "deny" }),
      getAgentNames(userId),
    ]);

    setStats(s);
    setHourlyData(h);
    setRecentDenied(logs.slice(0, 8));
    const allData = await getAuditLogs(userId);
    setAllLogs(allData);
    setAgentNames(names);
  }, [userId]);

  useEffect(() => {
    loadData();

    // Auto-refresh every 15 seconds
    intervalRef.current = setInterval(loadData, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-slate-800/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Overview</h2>
        <p className="mt-1 text-sm text-slate-400">
          Real-time agent activity and policy enforcement
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Calls"
          value={stats.totalCalls.toLocaleString()}
          icon={Activity}
          iconColor="bg-blue-500/10 text-blue-400"
          trend={{ value: 12.3, positive: true }}
        />
        <StatsCard
          title="Denied Calls"
          value={stats.deniedCalls.toLocaleString()}
          icon={ShieldAlert}
          iconColor="bg-red-500/10 text-red-400"
          trend={{ value: 4.1, positive: false }}
        />
        <StatsCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={ClipboardCheck}
          iconColor="bg-amber-500/10 text-amber-400"
        />
        <StatsCard
          title="Allow Rate"
          value={`${stats.allowRate.toFixed(1)}%`}
          icon={TrendingUp}
          iconColor="bg-emerald-500/10 text-emerald-400"
          trend={{ value: 0.8, positive: true }}
        />
      </div>

      {/* Chart + Denied side by side */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 xl:col-span-3">
          <h3 className="mb-1 text-sm font-semibold text-white">
            Tool Call Volume
          </h3>
          <p className="mb-5 text-xs text-slate-500">Last 24 hours</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourlyData} barGap={2}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "0.75rem",
                  color: "#e2e8f0",
                  fontSize: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
                }}
                cursor={{ fill: "rgba(148,163,184,0.05)" }}
              />
              <Bar
                dataKey="allowed"
                fill="#10b981"
                radius={[3, 3, 0, 0]}
                name="Allowed"
              />
              <Bar
                dataKey="denied"
                fill="#ef4444"
                radius={[3, 3, 0, 0]}
                name="Denied"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent denied */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 xl:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <ShieldX className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">
              Recent Denied
            </h3>
          </div>
          <div className="space-y-1">
            {recentDenied.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-800/50"
              >
                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-slate-300">
                    {log.tool}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {agentNames[log.agentId] ?? log.agentId}
                    {log.denialReason ? ` \u2014 ${log.denialReason}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {recentDenied.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No denied calls recorded
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live feed */}
      <LiveFeed logs={allLogs} agentNames={agentNames} />
    </div>
  );
}
