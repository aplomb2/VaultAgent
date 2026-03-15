"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-emerald-400 bg-emerald-500/10",
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-800 bg-slate-900/50 p-6",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {trend && (
            <div
              className={clsx(
                "inline-flex items-center gap-1 text-xs font-medium",
                trend.positive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.positive ? "+" : ""}
              {trend.value}%
              <span className="text-slate-500">vs last period</span>
            </div>
          )}
        </div>
        <div className={clsx("rounded-xl p-2.5", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
