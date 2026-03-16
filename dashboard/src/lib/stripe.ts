import Stripe from "stripe";

// Stripe singleton — only initialized when STRIPE_SECRET_KEY is set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

// ── Plan Limits ─────────────────────────────────────────────────────────────

export type PlanName = "free" | "pro" | "team" | "enterprise";

export interface PlanLimits {
  maxAgents: number; // 0 = unlimited
  maxEventsPerDay: number; // 0 = unlimited
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { maxAgents: 3, maxEventsPerDay: 1_000 },
  pro: { maxAgents: 10, maxEventsPerDay: 100_000 },
  team: { maxAgents: 50, maxEventsPerDay: 1_000_000 },
  enterprise: { maxAgents: 0, maxEventsPerDay: 0 },
};

// ── Price Mappings ──────────────────────────────────────────────────────────

const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO ?? "";
const STRIPE_PRICE_ID_TEAM = process.env.STRIPE_PRICE_ID_TEAM ?? "";

export const PRICE_TO_PLAN: Record<string, PlanName> = {
  ...(STRIPE_PRICE_ID_PRO ? { [STRIPE_PRICE_ID_PRO]: "pro" } : {}),
  ...(STRIPE_PRICE_ID_TEAM ? { [STRIPE_PRICE_ID_TEAM]: "team" } : {}),
};

export const PLAN_TO_PRICE: Partial<Record<PlanName, string>> = {
  ...(STRIPE_PRICE_ID_PRO ? { pro: STRIPE_PRICE_ID_PRO } : {}),
  ...(STRIPE_PRICE_ID_TEAM ? { team: STRIPE_PRICE_ID_TEAM } : {}),
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Determine the effective plan, accounting for grace period on cancellation. */
export function getEffectivePlan(user: {
  plan?: string;
  subscription_status?: string;
  subscription_ends_at?: string | null;
}): PlanName {
  const plan = (user.plan ?? "free") as PlanName;

  // Active subscription — use current plan
  if (user.subscription_status === "active") {
    return plan;
  }

  // Canceled but within grace period (3 days after subscription end)
  if (
    user.subscription_status === "canceled" &&
    user.subscription_ends_at
  ) {
    const endsAt = new Date(user.subscription_ends_at);
    const graceEnd = new Date(endsAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    if (new Date() < graceEnd) {
      return plan;
    }
  }

  return "free";
}
