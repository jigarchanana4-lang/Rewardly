import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { NextResponse } from "next/server";
import { one } from "@/lib/utils";

/** RFC-4180 quoting. Also blunts CSV injection — a cell starting =,+,-,@ is
 *  executed as a formula by Excel and Sheets, and customer names are attacker
 *  controlled. */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Owner exports their own customer list. Their data, on their way out — the
 * absence of this is a standard objection during a sale, and lock-in is not a
 * feature worth defending.
 */
export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "owner-export"), 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many exports. Try again shortly." }, { status: 429 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, name, slug, owner_id")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!rest) return NextResponse.json({ error: "no business found" }, { status: 404 });

  const { data: cards } = await svc
    .from("loyalty_cards")
    .select(
      "current_stamps, current_points, total_visits, created_at, updated_at, profiles:user_id(full_name, phone_number, marketing_opt_in)",
    )
    .eq("restaurant_id", rest.id)
    .order("total_visits", { ascending: false });

  const header = [
    "name",
    "phone",
    "visits",
    "stamps",
    "points",
    "marketing_opt_in",
    "first_seen",
    "last_activity",
  ];

  const rows = (cards ?? []).map((c) => {
    const p = one<{ full_name?: string; phone_number?: string; marketing_opt_in?: boolean }>(c.profiles);
    return [
      p?.full_name ?? "",
      p?.phone_number ?? "",
      c.total_visits,
      c.current_stamps,
      c.current_points,
      p?.marketing_opt_in === false ? "no" : "yes",
      c.created_at,
      c.updated_at,
    ]
      .map(cell)
      .join(",");
  });

  // BOM so Excel opens UTF-8 names (Hindi, accents) correctly instead of mojibake.
  const csv = "﻿" + [header.map(cell).join(","), ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${rest.slug}-customers-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
