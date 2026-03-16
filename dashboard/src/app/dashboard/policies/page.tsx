"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PolicyEditor from "@/components/PolicyEditor";
import type { Agent, PolicyConfig } from "@/lib/types";
import { getPolicies, updatePolicies, getAgents } from "@/lib/store";

export default function PoliciesPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [config, setConfig] = useState<PolicyConfig | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [policiesData, agentsData] = await Promise.all([
        getPolicies(userId),
        getAgents(userId),
      ]);

      setConfig(policiesData);
      setAgents(agentsData);
      setLoading(false);
    }

    load();
  }, [userId]);

  async function handleSave(newConfig: PolicyConfig) {
    if (!userId) return;
    await updatePolicies(userId, newConfig);
  }

  if (loading || !config) {
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
        <h2 className="text-xl font-semibold text-white">Policies</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure per-agent tool permissions and constraints
        </p>
      </div>
      <PolicyEditor
        initialConfig={config}
        agents={agents}
        onSave={handleSave}
      />
    </div>
  );
}
