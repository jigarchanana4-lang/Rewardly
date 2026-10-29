import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BRAND } from "@/config/brand";

/**
 * One-off trial credit grant, called once at onboarding.
 *
 * Idempotent on the restaurant id rather than a request id: the grant is
 * "this shop's trial credits", and there is only ever one of those. Deleting
 * and recreating a shop would grant again, which is fine — that's a new shop.
 */
export async function POST(req: Request) {
  const { restaurantId } = (await req.json()) as { restaurantId?: string };
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { data, error } = await svc.rpc("add_credits", {
    p_restaurant_id: restaurantId,
    p_amount: BRAND.credits.trialGrant,
    p_kind: "grant",
    p_request_id: `trial:${restaurantId}`,
    p_note: "Trial credits",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ credits: data });
}
