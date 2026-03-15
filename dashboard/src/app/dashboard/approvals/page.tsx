"use client";

import { useState } from "react";
import { ClipboardCheck, ChevronDown, ChevronRight } from "lucide-react";
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-amber-400" />
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Approval Queue
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Review and resolve pending tool execution requests
          </p>
        </div>
      </div>

      {/* Pending approvals */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-200">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center">
            <p className="text-slate-400">
              No pending approvals. All clear!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
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

      {/* Resolved approvals (collapsible) */}
      <div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-200 hover:text-slate-100"
        >
          {showResolved ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
          Resolved ({resolved.length})
        </button>

        {showResolved && (
          <div className="grid gap-4 md:grid-cols-2">
            {resolved.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
