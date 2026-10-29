import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { verifyOrderSignature, verifySubscriptionSignature } from "@/lib/razorpay";
import { sendEmail, receiptEmail } from "@/lib/email";
import { BRAND, TIERS, TierId } from "@/config/brand";
import { issueInvoice, paise } from "@/lib/invoice";
import { rateLimit, clientKey } from "@/lib/ratelimit";

/**
 * Verify a Razorpay callback server-side and activate the subscription.
 * Never trust the client — the signature proves the payment is genuine.
 */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "rzp-verify"), 20, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many verification attempts." }, { status: 429 });

  const body = (await req.json()) as {
    mode: "subscription" | "order";
    restaurantId: string;
    tier: TierId;
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature: string;
  };

  // Owner check.
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });
  const { data: rest } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", body.restaurantId)
    .single();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  // Signature verification.
  let ok = false;
  if (body.mode === "subscription" && body.razorpay_subscription_id) {
    ok = verifySubscriptionSignature(
      body.razorpay_payment_id,
      body.razorpay_subscription_id,
      body.razorpay_signature,
    );
  } else if (body.mode === "order" && body.razorpay_order_id) {
    ok = verifyOrderSignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );
  }
  if (!ok) return NextResponse.json({ error: "signature mismatch" }, { status: 400 });

  // Activate. Service client writes the subscription row (RLS-exempt, trusted).
  const svc = createServiceClient();
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const { error } = await svc.from("subscriptions").upsert(
    {
      restaurant_id: body.restaurantId,
      tier: body.tier,
      status: "active",
      razorpay_subscription_id: body.razorpay_subscription_id ?? null,
      razorpay_payment_id: body.razorpay_payment_id,
      current_period_end: periodEnd.toISOString(),
    },
    { onConflict: "restaurant_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from("restaurants").update({ is_active: true }).eq("id", body.restaurantId);

  // Plan credit grant. Idempotent on the payment id, so a webhook retry or a
  // refreshed callback page cannot hand out a second month's credits.
  const grant = BRAND.credits.grantByTier[body.tier] ?? 0;
  if (grant > 0) {
    await svc.rpc("add_credits", {
      p_restaurant_id: body.restaurantId,
      p_amount: grant,
      p_kind: "grant",
      p_request_id: `plan:${body.razorpay_payment_id}`,
      p_note: `${body.tier} plan credits`,
    });
  }

  // GST invoice. Best-effort and idempotent on the payment id — a failure here
  // must never fail the payment the customer already made.
  let invoice: { id: string; number: string } | null = null;
  try {
    invoice = await issueInvoice(svc, {
      restaurantId: body.restaurantId,
      tier: body.tier,
      amountPaise: paise(TIERS[body.tier].price),
      razorpayPaymentId: body.razorpay_payment_id,
    });
  } catch {
    // Swallowed deliberately; the owner can re-issue from Billing.
  }

  // Receipt email (best-effort; logged in DEV).
  const { data: rInfo } = await svc
    .from("restaurants")
    .select("name")
    .eq("id", body.restaurantId)
    .maybeSingle();
  if (auth.user.email) {
    const mail = receiptEmail(rInfo?.name ?? "your business", TIERS[body.tier].name, TIERS[body.tier].price);
    await sendEmail(auth.user.email, mail.subject, mail.html);
  }

  return NextResponse.json({ ok: true, tier: body.tier, price: TIERS[body.tier].price, invoice });
}
