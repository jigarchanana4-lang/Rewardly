import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RestaurantCard from "@/components/RestaurantCard";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "Explore local businesses with rewards",
  description: "Find cafés, salons, gyms and shops near you offering free loyalty rewards.",
};

const CATEGORIES = ["cafe", "restaurant", "bakery", "salon", "gym", "bar"];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string };
}) {
  const supabase = createClient();
  let query = supabase
    .from("restaurants")
    .select("name, slug, category, logo_url, reward_title, address")
    .eq("is_active", true)
    .order("total_visits", { ascending: false })
    .limit(50);

  if (searchParams.category) query = query.eq("category", searchParams.category);
  if (searchParams.search) query = query.ilike("name", `%${searchParams.search}%`);

  const { data: businesses } = await query;

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <div className="label">Rewards near you</div>
      <h1 className="display mt-1 text-[34px]">Explore</h1>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link
          href="/explore"
          className={`chip shrink-0 whitespace-nowrap ${
            !searchParams.category ? "border-edge bg-brand text-on-brand" : "border-line bg-surface text-ink-2"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/explore?category=${c}`}
            className={`chip shrink-0 whitespace-nowrap capitalize ${
              searchParams.category === c
                ? "border-edge bg-brand text-on-brand"
                : "border-line bg-surface text-ink-2"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {businesses && businesses.length > 0 ? (
          businesses.map((r) => <RestaurantCard key={r.slug} r={r} />)
        ) : (
          <div className="rounded-lg border-2 border-dashed border-line bg-surface p-8 text-center">
            <div className="display text-xl">Nothing in this category</div>
            <p className="mt-1.5 text-sm font-medium text-ink-2">Try another one, or check back soon.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
