import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ShopTheme from "@/components/ShopTheme";
import MenuBrowser from "@/components/MenuBrowser";
import { BRAND } from "@/config/brand";
import type { Restaurant, MenuCategory, MenuItem } from "@/lib/types";

/**
 * Smart Menu — the standalone public menu.
 *
 * Separate from /shop/[slug] on purpose. A café buying a digital menu prints a
 * QR that should open THE MENU, not a loyalty page with a menu at the bottom.
 * Short path because it goes on a printed table card.
 */

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("name, description")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!data) return { title: "Menu not found" };
  return {
    title: `${data.name} — menu`,
    description: data.description ?? `See the full menu at ${data.name}.`,
  };
}

export default async function MenuPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: r } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();
  if (!r) notFound();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("*")
      .eq("restaurant_id", r.id)
      .order("sort_order")
      .returns<MenuCategory[]>(),
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", r.id)
      .eq("is_available", true)
      .order("sort_order")
      .returns<MenuItem[]>(),
  ]);

  const menu = items ?? [];

  return (
    <ShopTheme id={r.id} brand={r.brand_color} accent={r.accent_color}>
      <main className="mx-auto max-w-md px-4 pb-20 pt-6">
        <header className="mb-6 flex items-center gap-3.5">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-edge bg-brand-soft text-xl font-extrabold text-brand shadow-pop">
            {r.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              r.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="label">Menu</div>
            <h1 className="display truncate text-2xl">{r.name}</h1>
          </div>
        </header>

        {menu.length > 0 ? (
          <MenuBrowser categories={categories ?? []} items={menu} />
        ) : (
          <div className="rounded-lg border-2 border-dashed border-line bg-surface p-8 text-center">
            <div className="display text-lg">Menu coming soon</div>
            <p className="mt-1 text-sm font-medium text-ink-2">
              This shop hasn&rsquo;t published their menu yet.
            </p>
          </div>
        )}

        {r.stamp_card_enabled && (
          <Link
            href={`/shop/${r.slug}`}
            className="mt-8 flex items-center justify-between gap-3 rounded-lg border-2 border-edge bg-accent p-4 text-accent-ink shadow-pop"
          >
            <div>
              <div className="display text-lg">Collect a stamp while you&rsquo;re here</div>
              <div className="text-sm font-semibold opacity-80">
                {r.reward_title ?? "Free reward"} after {r.stamps_required} visits
              </div>
            </div>
            <span className="shrink-0 text-xl">→</span>
          </Link>
        )}

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
