import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { accessFromSub } from "@/lib/subscription";
import type { Subscription } from "@/lib/types";

/**
 * Self-serve account deletion. The privacy policy promises this, so it has to
 * actually work rather than route to an inbox.
 *
 * Deleting the auth user cascades all the way down: auth.users → profiles →
 * restaurants, loyalty_cards, rewards, scans, referrals (seven FKs, all
 * `on delete cascade`). One delete, nothing orphaned.
 */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "account-delete"), 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();

  // A shop with a live plan must cancel first. Deleting it here would strand
  // its customers' stamps and leave a Razorpay subscription still billing.
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (rest) {
    const { data: sub } = await svc
      .from("subscriptions")
      .select("status, trial_end, current_period_end")
      .eq("restaurant_id", rest.id)
      .maybeSingle<Pick<Subscription, "status" | "trial_end" | "current_period_end">>();

    if (accessFromSub(sub).active) {
      return NextResponse.json(
        {
          error:
            "Cancel your plan before deleting your account, so billing stops and your customers aren't left with stamps that can't be redeemed.",
        },
        { status: 409 },
      );
    }
  }

  const { error } = await svc.auth.admin.deleteUser(auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ deleted: true });
}
