"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AuditLogTable from "@/components/AuditLogTable";
import type { Agent, AuditLogEntry } from "@/lib/types";
import { getAuditLogs, getAgents, getAgentNames } from "@/lib/store";

export default function LogsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [logsData, agentsData, names] = await Promise.all([
        getAuditLogs(userId),
        getAgents(userId),
        getAgentNames(userId),
      ]);

      setLogs(logsData);
      setAgents(agentsData);
      setAgentNames(names);
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
