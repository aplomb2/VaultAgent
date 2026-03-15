"use client";

import PolicyEditor from "@/components/PolicyEditor";

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Policies</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure per-agent tool permissions and constraints
        </p>
      </div>
      <PolicyEditor />
    </div>
  );
}
