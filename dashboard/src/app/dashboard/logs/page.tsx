"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AuditLogTable from "@/components/AuditLogTable";
import type { Agent, AuditLogEntry } from "@/lib/types";
import { getAuditLogs, getAgents, getAgentNames } from "@/lib/store";
import { getDemoAuditLogs, getDemoAgents, getDemoAgentNames } from "@/lib/demo-data";

export default function LogsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [logsData, agentsData, names] = await Promise.all([
        getAuditLogs(userId),
        getAgents(userId),
        getAgentNames(userId),
      ]);

      if (logsData.length === 0) {
        setLogs(getDemoAuditLogs());
        setAgents(getDemoAgents());
        setAgentNames(getDemoAgentNames());
        setIsDemo(true);
      } else {
        setLogs(logsData);
        setAgents(agentsData);
        setAgentNames(names);
        setIsDemo(false);
      }
      setLoading(false);
    }

    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-800/50" />
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

      <div>
        <h2 className="text-xl font-semibold text-white">Audit Logs</h2>
        <p className="mt-1 text-sm text-slate-400">
          Complete record of all tool invocations and policy decisions
        </p>
      </div>
      <AuditLogTable logs={logs} agents={agents} agentNames={agentNames} />
    </div>
  );
}
