import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Razorpay webhook. Verifies the payload signature, then reflects subscription
 * lifecycle changes into our DB. Configure the endpoint + secret in the
 * Razorpay dashboard (Settings → Webhooks). Subscribe to:
 *   subscription.charged, subscription.halted, subscription.cancelled, payment.failed
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers.get("x-razorpay-signature");
  const raw = await req.text();

  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);
  const svc = createServiceClient();

  const subEntity = event?.payload?.subscription?.entity;
  const restaurantId = subEntity?.notes?.restaurant_id as string | undefined;

  async function setStatus(status: string, extra: Record<string, unknown> = {}) {
    if (!restaurantId) return;
    await svc.from("subscriptions").update({ status, ...extra }).eq("restaurant_id", restaurantId);
  }

  switch (event?.event) {
    case "subscription.charged": {
      const end = new Date();
      end.setFullYear(end.getFullYear() + 1);
      await setStatus("active", { current_period_end: end.toISOString() });
      if (restaurantId) await svc.from("restaurants").update({ is_active: true }).eq("id", restaurantId);
      break;
    }
    case "subscription.halted":
    case "payment.failed":
      await setStatus("expired");
      if (restaurantId) await svc.from("restaurants").update({ is_active: false }).eq("id", restaurantId);
      break;
    case "subscription.cancelled":
      await setStatus("cancelled");
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
