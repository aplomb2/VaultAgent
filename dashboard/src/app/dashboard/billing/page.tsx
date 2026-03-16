"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Bot,
  Activity,
} from "lucide-react";
import clsx from "clsx";
import { getUserPlan, getAgentCount } from "@/lib/store";

interface PlanInfo {
  plan: string;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  maxAgents: number;
  maxEventsPerDay: number;
  eventsToday: number;
  agentCount: number;
  stripeCustomerId: string | null;
  isGracePeriod: boolean;
}

const planLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

const planPrices: Record<string, string> = {
  free: "$0",
  pro: "$99",
  team: "$499",
  enterprise: "Custom",
};

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-800/50" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const userId = (session?.user as Record<string, unknown>)?.id as string;

  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const autoCheckout = searchParams.get("checkout");

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [plan, agentCount] = await Promise.all([
        getUserPlan(userId),
        getAgentCount(userId),
      ]);
      setPlanInfo({ ...plan, agentCount });
      setLoading(false);
    }

    load();
  }, [userId]);

  // Auto-checkout: if ?checkout=pro or ?checkout=team, trigger checkout immediately
  useEffect(() => {
    if (!autoCheckout || loading || !planInfo) return;
    if (autoCheckout === "pro" || autoCheckout === "team") {
      if (planInfo.plan === "free") {
        handleCheckout(autoCheckout);
      }
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, loading]);

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        setCheckoutLoading(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Portal error:", data.error);
        setPortalLoading(false);
      }
    } catch (err) {
      console.error("Portal error:", err);
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-800/50" />
      </div>
    );
  }

  if (!planInfo) {
    return (
      <div className="text-sm text-slate-400">
        Unable to load billing information.
      </div>
    );
  }

  const agentUsagePercent =
    planInfo.maxAgents > 0
      ? Math.min(100, (planInfo.agentCount / planInfo.maxAgents) * 100)
      : 0;
  const eventUsagePercent =
    planInfo.maxEventsPerDay > 0
      ? Math.min(100, (planInfo.eventsToday / planInfo.maxEventsPerDay) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Billing</h2>
        <p className="mt-1 text-sm text-slate-400">
          Manage your subscription and usage
        </p>
      </div>

      {/* Success/Canceled banners */}
      {success && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
          <Check className="mr-2 inline h-4 w-4" />
          Subscription activated successfully! Your plan has been updated.
        </div>
      )}
      {canceled && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-400">
          Checkout was canceled. No changes were made.
        </div>
      )}

      {/* Grace period warning */}
      {planInfo.isGracePeriod && planInfo.subscriptionEndsAt && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Your subscription has been canceled. You have access until{" "}
          {new Date(planInfo.subscriptionEndsAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          . After that, your plan will revert to Free.
        </div>
      )}

      {/* Current Plan Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <CreditCard className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {planLabels[planInfo.plan] ?? planInfo.plan} Plan
                </h3>
                <p className="text-sm text-slate-500">
                  {planPrices[planInfo.plan] ?? ""}{planInfo.plan !== "free" && planInfo.plan !== "enterprise" ? "/month" : planInfo.plan === "free" ? " forever" : ""}
                </p>
              </div>
            </div>
          </div>

          {planInfo.stripeCustomerId && planInfo.plan !== "free" && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage Subscription
            </button>
          )}
        </div>
      </div>

      {/* Usage Meters */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Agents */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-300">Agents</span>
          </div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {planInfo.agentCount}
            </span>
            <span className="text-sm text-slate-500">
              / {planInfo.maxAgents === 0 ? "unlimited" : planInfo.maxAgents}
            </span>
          </div>
          {planInfo.maxAgents > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={clsx(
                  "h-full rounded-full transition-all",
                  agentUsagePercent >= 90
                    ? "bg-red-500"
                    : agentUsagePercent >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{ width: `${agentUsagePercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Events */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-300">
              Events Today
            </span>
          </div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {planInfo.eventsToday.toLocaleString()}
            </span>
            <span className="text-sm text-slate-500">
              /{" "}
              {planInfo.maxEventsPerDay === 0
                ? "unlimited"
                : planInfo.maxEventsPerDay.toLocaleString()}
            </span>
          </div>
          {planInfo.maxEventsPerDay > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={clsx(
                  "h-full rounded-full transition-all",
                  eventUsagePercent >= 90
                    ? "bg-red-500"
                    : eventUsagePercent >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{ width: `${eventUsagePercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Options */}
      {(planInfo.plan === "free" || planInfo.plan === "pro") && (
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">
            {planInfo.plan === "free" ? "Upgrade Your Plan" : "Need More?"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {planInfo.plan === "free" && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                <h4 className="text-base font-semibold text-white">Pro</h4>
                <p className="mt-1 text-2xl font-bold text-white">
                  $99<span className="text-sm font-normal text-slate-500">/mo</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> 10 agents
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> 100K events/day
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> 90-day log retention
                  </li>
                </ul>
                <button
                  onClick={() => handleCheckout("pro")}
                  disabled={checkoutLoading !== null}
                  className="mt-4 w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {checkoutLoading === "pro" ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Upgrade to Pro"
                  )}
                </button>
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h4 className="text-base font-semibold text-white">Team</h4>
              <p className="mt-1 text-2xl font-bold text-white">
                $499<span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> 50 agents
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> 1M events/day
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> 1-year log retention
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> SSO / SAML
                </li>
              </ul>
              <button
                onClick={() => handleCheckout("team")}
                disabled={checkoutLoading !== null}
                className="mt-4 w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {checkoutLoading === "team" ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Upgrade to Team"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
