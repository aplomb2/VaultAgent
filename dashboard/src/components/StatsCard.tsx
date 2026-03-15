"use client";

import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-1 text-3xl font-bold text-slate-100">{value}</p>
          {trend && (
            <p
              className={clsx(
                "mt-1 text-sm font-medium",
                trend.positive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.positive ? "+" : ""}
              {trend.value}% from last period
            </p>
          )}
        </div>
        <div className="rounded-lg bg-slate-700/50 p-3">
          <Icon className="h-6 w-6 text-slate-300" />
        </div>
      </div>
    </div>
  );
}
