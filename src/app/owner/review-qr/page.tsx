import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReviewQRSetup from "@/components/ReviewQRSetup";
import type { Restaurant } from "@/lib/types";

export const metadata = { title: "Review QR" };

const DAY = 864e5;

export default async function ReviewQrPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/review-qr");

  const { data: r } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", auth.user.id)
    .maybeSingle<Restaurant>();
  if (!r) redirect("/onboarding/owner");

  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [{ count: total }, { count: last30 }] = await Promise.all([
    supabase.from("review_qr_scans").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    supabase
      .from("review_qr_scans")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id)
      .gte("scanned_at", since),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-3xl">
      <Link href="/owner" className="text-sm font-bold text-brand underline decoration-2 underline-offset-4 lg:hidden">
        ← Dashboard
      </Link>
      <div className="label mt-2">Free · included on every plan</div>
      <h1 className="display mt-1 text-[34px]">Review QR</h1>
      <p className="mt-1.5 font-medium text-ink-2">
        One scan takes a customer straight to your Google review page — no searching, no typing.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border-2 border-edge bg-brand p-3 text-on-brand shadow-pop">
          <div className="display text-3xl tabular-nums">{total ?? 0}</div>
          <div className="eyebrow mt-0.5 opacity-70">Scans all time</div>
        </div>
        <div className="rounded-lg border-2 border-edge bg-accent p-3 text-accent-ink shadow-pop">
          <div className="display text-3xl tabular-nums">{last30 ?? 0}</div>
          <div className="eyebrow mt-0.5 opacity-70">Last 30 days</div>
        </div>
      </div>

      <ReviewQRSetup
        restaurantId={r.id}
        slug={r.slug}
        shopName={r.name}
        siteUrl={siteUrl}
        initialUrl={r.google_review_url}
        initialPrompt={r.google_review_text}
        initialEnabled={r.review_qr_enabled}
        brandColor={r.brand_color}
      />
    </main>
  );
}
