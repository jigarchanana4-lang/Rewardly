import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";
import { rateLimit, clientKey } from "@/lib/ratelimit";

/** Owner sends an app (web-push) notification to their shop's subscribed customers. */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "push-send"), 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many sends." }, { status: 429 });

  const { restaurantId, title, body } = (await req.json()) as {
    restaurantId: string;
    title: string;
    body: string;
  };
  if (!title?.trim() || !body?.trim())
    return NextResponse.json({ error: "title and body required" }, { status: 400 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc.from("restaurants").select("id, slug, owner_id").eq("id", restaurantId).single();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  // Customers of this shop who have push subscriptions.
  const { data: cards } = await svc.from("loyalty_cards").select("user_id").eq("restaurant_id", restaurantId);
  let userIds = [...new Set((cards ?? []).map((c) => c.user_id))];
  if (userIds.length === 0) return NextResponse.json({ sent: 0, recipients: 0 });

  // Respect marketing opt-out.
  const { data: optedIn } = await svc
    .from("profiles")
    .select("id")
    .in("id", userIds)
    .eq("marketing_opt_in", true);
  userIds = (optedIn ?? []).map((p) => p.id);
  if (userIds.length === 0) return NextResponse.json({ sent: 0, recipients: 0 });

  const { data: subs } = await svc
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/shop/${rest.slug}`;
  let sent = 0;
  const dead: string[] = [];
  let dev = false;

  await Promise.all(
    (subs ?? []).map(async (s) => {
      const res = await sendPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { title, body, url },
      );
      if (res.ok) sent += 1;
      if (res.dev) dev = true;
      if (res.gone) dead.push(s.id);
    }),
  );

  if (dead.length) await svc.from("web_push_subscriptions").delete().in("id", dead);

  return NextResponse.json({ recipients: subs?.length ?? 0, sent, dev });
}
