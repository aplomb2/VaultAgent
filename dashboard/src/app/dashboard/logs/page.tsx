"use client";

import { ScrollText } from "lucide-react";
import AuditLogTable from "@/components/AuditLogTable";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-slate-300" />
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Audit Logs</h2>
          <p className="mt-1 text-sm text-slate-400">
            Complete record of all tool invocations and policy decisions
          </p>
        </div>
      </div>

      <AuditLogTable />
    </div>
  );
}
