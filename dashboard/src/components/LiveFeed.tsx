"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import clsx from "clsx";
import type { AuditLogEntry } from "@/lib/types";

const actionBadge: Record<string, string> = {
  allow: "bg-emerald-500/10 text-emerald-400",
  deny: "bg-red-500/10 text-red-400",
  require_approval: "bg-amber-500/10 text-amber-400",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

interface LiveFeedProps {
  logs: AuditLogEntry[];
  agentNames: Record<string, string>;
}

export default function LiveFeed({ logs, agentNames }: LiveFeedProps) {
  const [events, setEvents] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    setEvents(logs.slice(0, 20));

    if (logs.length === 0) return;

    const interval = setInterval(() => {
      setEvents((prev) => {
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
  }, [logs]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <Radio className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Live Feed</h3>
        <span className="relative ml-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      </div>

      <div className="max-h-80 space-y-1 overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800/50"
          >
            <span className="shrink-0 font-mono text-xs text-slate-500">
              {formatTime(event.timestamp)}
            </span>
            <span className="shrink-0 font-mono text-slate-300">
              {event.tool}
            </span>
            <span className="text-slate-600">-</span>
            <span className="truncate text-slate-400">
              {agentNames[event.agentId] ?? event.agentId}
            </span>
            <span
              className={clsx(
                "ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                actionBadge[event.action]
              )}
            >
              {event.action.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
