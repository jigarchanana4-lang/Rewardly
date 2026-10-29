import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Feedback IQ redirect. A customer scans the printed QR, lands here, gets
 * counted anonymously, and is sent straight to the shop's Google review page.
 *
 * Short path (`/r/slug`) on purpose: it goes on a printed card, so every
 * character is one more thing to mistype if the QR ever fails to read.
 *
 * Caching is defeated three ways, deliberately. A cached redirect never reaches
 * the server, so the scan is never recorded — the owner sees a counter stuck at
 * 1 and concludes the product is broken. `dynamic` + `revalidate` cover the
 * route segment, reading `headers()` opts out of static optimisation, and
 * no-store on the response stops the browser and any CDN in front of us from
 * short-circuiting the next scan.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  headers(); // opt out of static rendering

  const svc = createServiceClient();
  const { data } = await svc.rpc("log_review_scan", { p_slug: params.slug });

  const target = typeof data === "string" && data ? data : null;
  // No review link configured (or shop inactive) — send them to the shop page
  // rather than a dead end, since the card is already printed and in the wild.
  const destination = target ?? new URL(`/shop/${params.slug}`, req.url).toString();

  const res = NextResponse.redirect(destination, { status: 302 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return res;
}
