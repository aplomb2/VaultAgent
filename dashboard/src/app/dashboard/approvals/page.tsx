"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import ApprovalCard from "@/components/ApprovalCard";
import type { Approval } from "@/lib/types";
import {
  getApprovals,
  resolveApproval,
  getAgentNames,
} from "@/lib/store";
import { getDemoApprovals, getDemoAgentNames } from "@/lib/demo-data";

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [allApprovals, setAllApprovals] = useState<Approval[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [approvals, names] = await Promise.all([
        getApprovals(userId),
        getAgentNames(userId),
      ]);

      if (approvals.length === 0) {
        setAllApprovals(getDemoApprovals());
        setAgentNames(getDemoAgentNames());
        setIsDemo(true);
      } else {
        setAllApprovals(approvals);
        setAgentNames(names);
        setIsDemo(false);
      }
      setLoading(false);
    }

    load();
  }, [userId]);

  const pending = allApprovals.filter((a) => a.status === "pending");
  const resolved = allApprovals.filter((a) => a.status !== "pending");

  const userEmail = session?.user?.email ?? "unknown@vault.dev";

  async function handleApprove(id: string) {
    if (isDemo) return;
    const result = await resolveApproval(id, "approved", userEmail);
    if (result) {
      setAllApprovals((prev) =>
        prev.map((a) => (a.id === id ? result : a))
      );
    }
  }

  async function handleReject(id: string) {
    if (isDemo) return;
    const result = await resolveApproval(id, "rejected", userEmail);
    if (result) {
      setAllApprovals((prev) =>
        prev.map((a) => (a.id === id ? result : a))
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
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
      <div>
        <h2 className="text-xl font-semibold text-white">Approval Queue</h2>
        <p className="mt-1 text-sm text-slate-400">
          Review and resolve pending tool execution requests
        </p>
      </div>

      {/* Pending */}
      <div>
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-500">
          Pending
          <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-400">
            {pending.length}
          </span>
        </h3>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 py-12">
            <Inbox className="mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">
              No pending approvals
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                agentName={agentNames[approval.agentId] ?? approval.agentId}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>

      {/* Resolved (collapsible) */}
      <div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
        >
          {showResolved ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Resolved
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-medium text-slate-400">
            {resolved.length}
          </span>
        </button>

        {showResolved && (
          <div className="grid gap-4 lg:grid-cols-2">
            {resolved.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                agentName={agentNames[approval.agentId] ?? approval.agentId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
