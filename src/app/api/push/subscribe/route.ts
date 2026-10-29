import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";

/** Save (or update) the signed-in user's web-push subscription. */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "push-sub"), 30, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many subscription updates." }, { status: 429 });

  const { subscription } = (await req.json()) as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };
  if (!subscription?.endpoint) return NextResponse.json({ error: "invalid subscription" }, { status: 400 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const { error } = await supabase.from("web_push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
