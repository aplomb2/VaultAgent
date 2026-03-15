"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Shield,
  ClipboardCheck,
  ScrollText,
  Lock,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/policies", label: "Policies", icon: Shield },
  { href: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/dashboard/logs", label: "Audit Logs", icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-800 bg-slate-950">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
          <Lock className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">VaultAgent</h1>
          <p className="text-xs text-slate-500">Security Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-slate-800/80 text-white"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon
                className={clsx(
                  "h-4 w-4",
                  isActive ? "text-emerald-400" : "text-slate-500"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800/60 px-5 py-4">
        <p className="text-[11px] text-slate-600">VaultAgent v1.0.0</p>
      </div>
    </aside>
  );
}
