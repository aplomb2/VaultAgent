import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { getStripe, PLAN_TO_PRICE, type PlanName } from "@/lib/stripe";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan as PlanName | undefined;
  if (!plan || !PLAN_TO_PRICE[plan]) {
    return NextResponse.json(
      { error: "Invalid plan. Use 'pro' or 'team'." },
      { status: 400 },
    );
  }

  const priceId = PLAN_TO_PRICE[plan]!;
  const stripe = getStripe();
  const supabase = createServiceClient();

  // Find or create Stripe customer
  const { data: user } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  let customerId = user?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;

    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  // Create Checkout Session
  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
    success_url: `${origin}/dashboard/billing?success=true`,
    cancel_url: `${origin}/dashboard/billing?canceled=true`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
