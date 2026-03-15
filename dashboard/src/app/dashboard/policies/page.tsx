"use client";

import { Shield } from "lucide-react";
import PolicyEditor from "@/components/PolicyEditor";

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-emerald-400" />
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Policies</h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure per-agent tool permissions and constraints
          </p>
        </div>
      </div>

      <PolicyEditor />
    </div>
  );
}
