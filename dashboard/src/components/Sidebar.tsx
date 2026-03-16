"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Bot,
  Shield,
  ClipboardCheck,
  ScrollText,
  CreditCard,
  Lock,
  LogOut,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/policies", label: "Policies", icon: Shield },
  { href: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/dashboard/logs", label: "Audit Logs", icon: ScrollText },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

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

      {/* User menu */}
      <div className="border-t border-slate-800/60 px-3 py-3">
        {session?.user ? (
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="h-7 w-7 rounded-full ring-1 ring-slate-700"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-slate-400">
                {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-slate-300">
                {session.user.name ?? "User"}
              </p>
              <p className="truncate text-[10px] text-slate-600">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-400"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="px-2 text-[11px] text-slate-600">VaultAgent v1.0.0</p>
        )}
      </div>
    </aside>
  );
}
