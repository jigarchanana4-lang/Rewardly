import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendBroadcast, personalize } from "@/lib/whatsapp";
import { rateLimit, clientKey } from "@/lib/ratelimit";

type Audience = "all" | "near_reward" | "inactive";
const INACTIVE_DAYS = 21;
const NEAR_REWARD_GAP = 2;

/**
 * Send a WhatsApp broadcast to a segment of a shop's customers.
 * Owner-verified via the session; the actual audience (customer phone numbers)
 * is read with the service role since owners can't read others' profiles.
 */
export async function POST(req: Request) {
  const { restaurantId, name, body, audience } = (await req.json()) as {
    restaurantId: string;
    name: string;
    body: string;
    audience: Audience;
  };
  if (!name?.trim() || !body?.trim())
    return NextResponse.json({ error: "name and message required" }, { status: 400 });

  // Throttle: max 5 campaign sends per 10 minutes per IP.
  const rl = rateLimit(clientKey(req, "wa-send"), 5, 10 * 60_000);
  if (!rl.ok)
    return NextResponse.json({ error: `Too many sends. Try again in ${rl.retryAfter}s.` }, { status: 429 });

  // Owner check (session-scoped).
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, name, owner_id, stamps_required")
    .eq("id", restaurantId)
    .single();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  // Build the audience.
  let q = svc
    .from("loyalty_cards")
    .select("current_stamps, updated_at, profiles:user_id(full_name, phone_number, marketing_opt_in)")
    .eq("restaurant_id", restaurantId);

  if (audience === "near_reward") {
    q = q.gte("current_stamps", Math.max(1, rest.stamps_required - NEAR_REWARD_GAP));
  } else if (audience === "inactive") {
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 864e5).toISOString();
    q = q.lt("updated_at", cutoff);
  }

  const { data: cards, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const recipients = (cards ?? [])
    .map((c) => {
      const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      // Respect marketing opt-out (compliance).
      if (!p || p.marketing_opt_in === false) return null;
      return { phone: p.phone_number as string | null, name: p.full_name as string | null };
    })
    .filter((r): r is { phone: string; name: string | null } => !!r?.phone);

  // Fan out.
  const results = await Promise.allSettled(
    recipients.map((r) => sendBroadcast(r.phone, personalize(body, r.name, rest.name))),
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const dev = results.some((r) => r.status === "fulfilled" && r.value.dev);
  const failed = recipients.length - sent;

  await svc.from("campaigns").insert({
    restaurant_id: restaurantId,
    name,
    body,
    audience,
    status: "sent",
    recipients: recipients.length,
    sent,
    failed,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ recipients: recipients.length, sent, failed, dev });
}
