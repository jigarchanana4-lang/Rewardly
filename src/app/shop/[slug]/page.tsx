import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import StampCardView from "@/components/StampCardView";
import PointsCardView from "@/components/PointsCardView";
import ScanButton from "@/components/ScanButton";
import ScratchCard from "@/components/ScratchCard";
import ShopTheme from "@/components/ShopTheme";
import { BRAND } from "@/config/brand";
import { accessFromSub } from "@/lib/subscription";
import type { Restaurant, MenuItem, LoyaltyCard, Subscription } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("name, description, category, reward_title, logo_url")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!data) return { title: "Business not found" };
  return {
    title: `${data.name} — rewards & loyalty`,
    description:
      data.description ??
      `Collect stamps at ${data.name} and earn ${data.reward_title ?? "free rewards"}.`,
    openGraph: { images: data.logo_url ? [data.logo_url] : [] },
  };
}

export default async function ShopPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: r } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();

  if (!r) notFound();

  // Gate on plan status (hides shop when a trial/plan has lapsed).
  // Read via RPC: the subscriptions table is owner-read only, so a direct
  // select here returns nothing for the visitors this page actually serves.
  const { data: planRows } = await supabase.rpc("shop_plan", { p_restaurant_id: r.id });
  const sub =
    (planRows as Pick<Subscription, "status" | "trial_end" | "current_period_end">[] | null)?.[0] ?? null;
  if (!accessFromSub(sub).active) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="rounded-xl border-2 border-edge bg-surface p-8 shadow-pop-lg">
          <div className="label">Paused</div>
          <h1 className="display mt-2 text-2xl">{r.name} isn&rsquo;t stamping right now</h1>
          <p className="mt-2 font-medium text-ink-2">
            Check back soon — this shop will be open again shortly.
          </p>
        </div>
      </main>
    );
  }

  const { data: auth } = await supabase.auth.getUser();

  let card: LoyaltyCard | null = null;
  if (auth.user) {
    const { data } = await supabase
      .from("loyalty_cards")
      .select("*")
      .eq("restaurant_id", r.id)
      .eq("user_id", auth.user.id)
      .maybeSingle<LoyaltyCard>();
    card = data;
  }

  const { data: menu } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("is_available", true)
    .order("sort_order")
    .returns<MenuItem[]>();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, lat, lng")
    .eq("restaurant_id", r.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: r.name,
    description: r.description ?? undefined,
    image: r.logo_url ?? undefined,
    telephone: r.phone ?? undefined,
    address: r.address ?? undefined,
  };

  return (
    <ShopTheme id={r.id} brand={r.brand_color} accent={r.accent_color}>
      <main className="mx-auto max-w-md px-4 pb-16 pt-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mb-6 flex items-center gap-3.5">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-edge bg-brand-soft text-2xl font-extrabold text-brand shadow-pop">
          {r.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            r.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h1 className="display text-2xl">{r.name}</h1>
          <div className="truncate text-sm font-medium text-ink-2">
            {r.category && <span className="capitalize">{r.category}</span>}
            {r.address ? ` · ${r.address}` : ""}
          </div>
        </div>
      </header>

      {r.stamp_card_enabled && (
        <section className="space-y-4">
          {r.reward_mode === "points" ? (
            <PointsCardView restaurant={r} points={card?.current_points ?? 0} />
          ) : (
            <StampCardView restaurant={r} current={card?.current_stamps ?? 0} />
          )}
          <ScanButton restaurantId={r.id} branches={branches ?? []} />
        </section>
      )}

      {r.scratch_enabled && auth.user && (
        <section className="mt-6">
          <ScratchCard restaurantId={r.id} />
        </section>
      )}

      {r.google_review_url && (
        <a href={r.google_review_url} target="_blank" rel="noopener" className="btn-ghost mt-6 w-full">
          ⭐ {r.google_review_text ?? "Leave us a Google review"}
        </a>
      )}

      {r.social_links && Object.values(r.social_links).some(Boolean) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {r.social_links.instagram && (
            <a href={r.social_links.instagram} target="_blank" rel="noopener" className="chip-soft">Instagram</a>
          )}
          {r.social_links.facebook && (
            <a href={r.social_links.facebook} target="_blank" rel="noopener" className="chip-soft">Facebook</a>
          )}
          {r.social_links.whatsapp && (
            <a href={r.social_links.whatsapp} target="_blank" rel="noopener" className="chip-soft">WhatsApp</a>
          )}
          {r.social_links.website && (
            <a href={r.social_links.website} target="_blank" rel="noopener" className="chip-soft">Website</a>
          )}
        </div>
      )}

      {r.hours && Object.keys(r.hours).length > 0 && (
        <section className="mt-6">
          <h2 className="label mb-2">Opening hours</h2>
          <div className="card space-y-1">
            {Object.entries(r.hours).map(([day, val]) => (
              <div key={day} className="flex justify-between text-sm">
                <span className="font-semibold">{day}</span>
                <span className="text-ink-2">{val}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {menu && menu.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="display text-2xl">Menu</h2>
            <Link
              href={`/m/${r.slug}`}
              className="text-sm font-bold text-brand underline decoration-2 underline-offset-4"
            >
              Full menu →
            </Link>
          </div>
          <div className="space-y-2">
            {menu.slice(0, 4).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border-2 border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{m.name}</div>
                  {m.description && (
                    <div className="truncate text-sm font-medium text-ink-2">{m.description}</div>
                  )}
                </div>
                {m.price != null && (
                  <div className="shrink-0 font-mono font-bold tabular-nums">₹{m.price}</div>
                )}
              </div>
            ))}
          </div>
          {menu.length > 4 && (
            <Link href={`/m/${r.slug}`} className="btn-ghost mt-3 w-full">
              See all {menu.length} items
            </Link>
          )}
        </section>
      )}

      {!auth.user && (
        <p className="mt-8 text-center text-sm font-medium text-ink-2">
          Sign in to start collecting stamps at {r.name}.
        </p>
      )}

      {/* Tier A white-label drops this; the customer's account is unchanged. */}
      {!r.white_label && (
        <p className="mt-10 text-center">
          <Link href="/" className="eyebrow text-ink-2 transition hover:text-brand">
            Powered by {BRAND.name}
          </Link>
        </p>
      )}
      </main>
    </ShopTheme>
  );
}
