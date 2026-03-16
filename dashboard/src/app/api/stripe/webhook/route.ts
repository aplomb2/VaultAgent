import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe, PRICE_TO_PLAN } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const supabaseUserId = session.subscription
        ? (await getSubscriptionMetadata(session.subscription as string))
        : null;

      if (!supabaseUserId) {
        // Fall back to customer lookup
        const customerId = session.customer as string;
        await syncByCustomer(customerId, supabase);
        break;
      }

      // Get subscription to determine the plan
      const sub = await getStripe().subscriptions.retrieve(
        session.subscription as string,
      );
      const priceId = sub.items.data[0]?.price.id;
      const plan = priceId ? (PRICE_TO_PLAN[priceId] ?? "pro") : "pro";

      await supabase
        .from("users")
        .update({
          plan,
          stripe_subscription_id: sub.id,
          subscription_status: "active",
          subscription_ends_at: new Date(
            sub.items.data[0].current_period_end * 1000,
          ).toISOString(),
        })
        .eq("id", supabaseUserId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.supabase_user_id;
      if (!userId) {
        await syncByCustomer(sub.customer as string, supabase);
        break;
      }

      const priceId = sub.items.data[0]?.price.id;
      const plan = priceId ? (PRICE_TO_PLAN[priceId] ?? "pro") : "pro";
      const status = sub.cancel_at_period_end ? "canceled" : mapStatus(sub.status);

      await supabase
        .from("users")
        .update({
          plan,
          stripe_subscription_id: sub.id,
          subscription_status: status,
          subscription_ends_at: sub.cancel_at
            ? new Date(sub.cancel_at * 1000).toISOString()
            : new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.supabase_user_id;
      if (!userId) {
        await syncByCustomer(sub.customer as string, supabase);
        break;
      }

      // Set 3-day grace period from now
      const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      await supabase
        .from("users")
        .update({
          subscription_status: "canceled",
          subscription_ends_at: graceEnd.toISOString(),
        })
        .eq("id", userId);
      break;
    }
  }

  // Always return 200 to Stripe
  return NextResponse.json({ received: true });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return stripeStatus;
  }
}

async function getSubscriptionMetadata(
  subscriptionId: string,
): Promise<string | null> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return sub.metadata.supabase_user_id || null;
}

/** Fallback: sync plan by looking up user via stripe_customer_id */
async function syncByCustomer(
  customerId: string,
  supabase: ReturnType<typeof createServiceClient>,
) {
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: "active",
  });

  const sub = subs.data[0];
  if (sub) {
    const priceId = sub.items.data[0]?.price.id;
    const plan = priceId ? (PRICE_TO_PLAN[priceId] ?? "pro") : "pro";

    await supabase
      .from("users")
      .update({
        plan,
        stripe_subscription_id: sub.id,
        subscription_status: "active",
        subscription_ends_at: new Date(
          sub.items.data[0].current_period_end * 1000,
        ).toISOString(),
      })
      .eq("stripe_customer_id", customerId);
  } else {
    // No active subscription — set grace period
    const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await supabase
      .from("users")
      .update({
        subscription_status: "canceled",
        subscription_ends_at: graceEnd.toISOString(),
      })
      .eq("stripe_customer_id", customerId);
  }
}
