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
    border: "border-amber-500/20",
    badge: "bg-amber-500/10 text-amber-400",
    icon: Clock,
    label: "Pending",
  },
  approved: {
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle,
    label: "Approved",
  },
  rejected: {
    border: "border-red-500/20",
    badge: "bg-red-500/10 text-red-400",
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
        "rounded-xl border bg-slate-900/50 p-6 transition-colors",
        status.border
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
            <Terminal className="h-4 w-4 text-slate-400" />
          </div>
          <span className="font-mono text-sm font-semibold text-white">
            {approval.tool}
          </span>
        </div>
        <div
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            status.badge
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </div>
      </div>

      {/* Meta */}
      <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {getAgentName(approval.agentId)}
        </span>
        <span>{formatTimestamp(approval.createdAt)}</span>
      </div>

      {/* Input arguments */}
      <div className="mb-4 rounded-lg bg-slate-800/80 p-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Arguments
        </p>
        <pre className="overflow-x-auto font-mono text-xs text-slate-400">
          {JSON.stringify(approval.inputArgs, null, 2)}
        </pre>
      </div>

      {/* Resolved info */}
      {approval.status !== "pending" && approval.resolvedAt && (
        <p className="mb-3 text-xs text-slate-500">
          Resolved by{" "}
          <span className="text-slate-400">{approval.resolvedBy}</span>
          {" \u00b7 "}
          {formatTimestamp(approval.resolvedAt)}
        </p>
      )}

      {/* Actions */}
      {approval.status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove?.(approval.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => onReject?.(approval.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
