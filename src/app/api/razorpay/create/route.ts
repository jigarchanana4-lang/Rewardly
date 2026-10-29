import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { razorpay } from "@/lib/razorpay";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { TIERS, TierId, TRIAL_DAYS } from "@/config/brand";

/**
 * Create a Razorpay checkout intent for a tier.
 * Uses a Subscription when a plan id is configured, else falls back to a
 * one-time annual Order (works out-of-the-box with test keys, no plans).
 */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "rzp-create"), 10, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  const { restaurantId, tier } = (await req.json()) as { restaurantId: string; tier: TierId };
  const plan = TIERS[tier];
  if (!plan) return NextResponse.json({ error: "unknown tier" }, { status: 400 });

  // Must be the restaurant's owner.
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });
  const { data: rest } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .single();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const rzp = razorpay();
  const planId = process.env[plan.razorpayPlanEnv];

  try {
    if (planId) {
      const sub = await rzp.subscriptions.create({
        plan_id: planId,
        total_count: 1,
        customer_notify: 1,
        notes: { restaurant_id: restaurantId, tier },
      });
      return NextResponse.json({
        mode: "subscription",
        subscriptionId: sub.id,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: plan.price * 100,
      });
    }

    // Fallback: one-time annual order.
    const order = await rzp.orders.create({
      amount: plan.price * 100,
      currency: "INR",
      notes: { restaurant_id: restaurantId, tier },
    });
    return NextResponse.json({
      mode: "order",
      orderId: order.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      trialDays: TRIAL_DAYS,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "razorpay error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
