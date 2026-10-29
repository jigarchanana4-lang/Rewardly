import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { razorpay } from "@/lib/razorpay";
import { rateLimit, clientKey } from "@/lib/ratelimit";

/** Owner cancels their subscription. Cancels at Razorpay (if any) then marks cancelled. */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "sub-cancel"), 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many cancel attempts. Try again shortly." }, { status: 429 });

  const { restaurantId } = (await req.json()) as { restaurantId: string };

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .single();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { data: sub } = await svc
    .from("subscriptions")
    .select("razorpay_subscription_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (sub?.razorpay_subscription_id) {
    try {
      await razorpay().subscriptions.cancel(sub.razorpay_subscription_id, false);
    } catch {
      /* already cancelled / not found — proceed to mark locally */
    }
  }

  await svc.from("subscriptions").update({ status: "cancelled" }).eq("restaurant_id", restaurantId);
  return NextResponse.json({ ok: true });
}
