"use client";

import { CheckCircle, XCircle, Clock, User, Terminal } from "lucide-react";
import clsx from "clsx";
import type { Approval } from "@/lib/types";
import { getAgentName } from "@/lib/store";

interface ApprovalCardProps {
  approval: Approval;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const statusConfig = {
  pending: {
    bg: "border-amber-500/30 bg-amber-500/5",
    badge: "bg-amber-500/20 text-amber-400",
    icon: Clock,
    label: "Pending",
  },
  approved: {
    bg: "border-emerald-500/30 bg-emerald-500/5",
    badge: "bg-emerald-500/20 text-emerald-400",
    icon: CheckCircle,
    label: "Approved",
  },
  rejected: {
    bg: "border-red-500/30 bg-red-500/5",
    badge: "bg-red-500/20 text-red-400",
    icon: XCircle,
    label: "Rejected",
  },
};

export default function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const status = statusConfig[approval.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={clsx(
        "rounded-xl border bg-slate-800 p-5 shadow-lg transition-colors",
        status.bg
      )}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-slate-400" />
          <span className="font-mono text-lg font-semibold text-slate-100">
            {approval.tool}
          </span>
        </div>
        <div
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            status.badge
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
      </div>

      {/* Agent and timestamp */}
      <div className="mb-4 flex items-center gap-4 text-sm text-slate-400">
        <span className="flex items-center gap-1.5">
          <User className="h-4 w-4" />
          {getAgentName(approval.agentId)}
        </span>
        <span>{formatTimestamp(approval.createdAt)}</span>
      </div>

      {/* Input arguments */}
      <div className="mb-4 rounded-lg bg-slate-900 p-3">
        <p className="mb-1 text-xs font-medium uppercase text-slate-500">
          Input Arguments
        </p>
        <pre className="overflow-x-auto text-sm text-slate-300">
          {JSON.stringify(approval.inputArgs, null, 2)}
        </pre>
      </div>

      {/* Resolved info for non-pending */}
      {approval.status !== "pending" && approval.resolvedAt && (
        <div className="mb-3 text-sm text-slate-400">
          Resolved by{" "}
          <span className="text-slate-300">{approval.resolvedBy}</span> at{" "}
          {formatTimestamp(approval.resolvedAt)}
        </div>
      )}

      {/* Action buttons for pending */}
      {approval.status === "pending" && (
        <div className="flex gap-3">
          <button
            onClick={() => onApprove?.(approval.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => onReject?.(approval.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
