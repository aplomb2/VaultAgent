"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import ApprovalCard from "@/components/ApprovalCard";
import type { Approval } from "@/lib/types";
import { getApprovals, resolveApproval } from "@/lib/store";

export default function ApprovalsPage() {
  const [allApprovals, setAllApprovals] = useState<Approval[]>(getApprovals());
  const [showResolved, setShowResolved] = useState(false);

  const pending = allApprovals.filter((a) => a.status === "pending");
  const resolved = allApprovals.filter((a) => a.status !== "pending");

  function handleApprove(id: string) {
    resolveApproval(id, "approved", "admin@vault.dev");
    setAllApprovals([...getApprovals()]);
  }

  function handleReject(id: string) {
    resolveApproval(id, "rejected", "admin@vault.dev");
    setAllApprovals([...getApprovals()]);
  }

  return (
    <div className="space-y-6">
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
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
