import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";

/** Admin toggles a business's active status. */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "admin-shop"), 60, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many admin actions." }, { status: 429 });

  const { restaurantId, isActive } = (await req.json()) as { restaurantId: string; isActive: boolean };

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (role?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = createServiceClient();
  const { error } = await svc.from("restaurants").update({ is_active: isActive }).eq("id", restaurantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
