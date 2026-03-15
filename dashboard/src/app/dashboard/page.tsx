"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  ShieldAlert,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import StatsCard from "@/components/StatsCard";
import LiveFeed from "@/components/LiveFeed";
import {
  getStats,
  getAuditLogs,
  getHourlyVolume,
  getAgentName,
} from "@/lib/store";

const actionColors: Record<string, string> = {
  allow: "text-emerald-400",
  deny: "text-red-400",
  require_approval: "text-amber-400",
};

export default function DashboardOverview() {
  const stats = getStats();
  const hourlyData = useMemo(() => getHourlyVolume(), []);

  // Recent denied calls (last 10)
  const recentDenied = useMemo(
    () => getAuditLogs({ action: "deny" }).slice(0, 10),
    []
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-400">
          Real-time overview of agent activity and policy enforcement
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Calls"
          value={stats.totalCalls.toLocaleString()}
          icon={Activity}
          trend={{ value: 12.3, positive: true }}
        />
        <StatsCard
          title="Denied Calls"
          value={stats.deniedCalls.toLocaleString()}
          icon={ShieldAlert}
          trend={{ value: 4.1, positive: false }}
        />
        <StatsCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={ClipboardCheck}
        />
        <StatsCard
          title="Allow Rate"
          value={`${stats.allowRate.toFixed(1)}%`}
          icon={TrendingUp}
          trend={{ value: 0.8, positive: true }}
        />
      </div>

      {/* Bar chart: tool call volume last 24 hours */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">
          Tool Call Volume (Last 24 Hours)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hourlyData}>
            <XAxis
              dataKey="hour"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "0.5rem",
                color: "#e2e8f0",
              }}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Bar
              dataKey="allowed"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              name="Allowed"
            />
            <Bar
              dataKey="denied"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              name="Denied"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent denied calls */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">
          Recent Denied Calls
        </h3>
        <div className="space-y-2">
          {recentDenied.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 rounded-lg bg-slate-900/50 px-4 py-3 text-sm"
            >
              <span className="shrink-0 text-xs text-slate-500">
                {new Date(log.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className="font-mono text-slate-300">{log.tool}</span>
              <span className="text-slate-500">by</span>
              <span className="text-slate-300">
                {getAgentName(log.agentId)}
              </span>
              <span
                className={clsx(
                  "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  actionColors[log.action]
                )}
              >
                {log.action}
              </span>
              <span className="max-w-xs truncate text-xs text-slate-500">
                {log.denialReason}
              </span>
            </div>
          ))}
          {recentDenied.length === 0 && (
            <p className="text-sm text-slate-500">
              No denied calls recorded.
            </p>
          )}
        </div>
      </div>

      {/* Live feed */}
      <LiveFeed />
    </div>
  );
}
