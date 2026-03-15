"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import clsx from "clsx";
import type { AuditLogEntry } from "@/lib/types";
import { getAuditLogs, getAgentName } from "@/lib/store";

// Color map for action badges
const actionColors: Record<string, string> = {
  allow: "bg-emerald-500/20 text-emerald-400",
  deny: "bg-red-500/20 text-red-400",
  require_approval: "bg-amber-500/20 text-amber-400",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function LiveFeed() {
  const [events, setEvents] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    // Load initial events
    setEvents(getAuditLogs().slice(0, 20));

    // Simulate a live feed by rotating every 3 seconds
    const interval = setInterval(() => {
      setEvents((prev) => {
        const logs = getAuditLogs();
        const randomIndex = Math.floor(Math.random() * logs.length);
        const newEntry = {
          ...logs[randomIndex],
          id: `live-${Date.now()}`,
          timestamp: new Date().toISOString(),
        };
        return [newEntry, ...prev.slice(0, 19)];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-slate-100">Live Feed</h3>
        <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-lg bg-slate-900/50 px-3 py-2 text-sm"
          >
            <span className="shrink-0 text-xs text-slate-500">
              {formatTime(event.timestamp)}
            </span>
            <span className="shrink-0 font-mono text-slate-300">
              {event.tool}
            </span>
            <span className="text-slate-500">by</span>
            <span className="text-slate-300">
              {getAgentName(event.agentId)}
            </span>
            <span
              className={clsx(
                "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                actionColors[event.action]
              )}
            >
              {event.action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
