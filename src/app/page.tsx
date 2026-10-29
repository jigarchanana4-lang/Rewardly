import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/config/brand";
import RestaurantCard from "@/components/RestaurantCard";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";

const TICKER = ["cafés", "salons", "gyms", "bakeries", "bars", "barbers", "juice bars", "studios"];

export default async function HomePage() {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: banners } = await supabase
    .from("hero_banners")
    .select("title, subtitle")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1);

  const { data: featured } = await supabase
    .from("restaurants")
    .select("name, slug, category, logo_url, reward_title, address")
    .eq("is_active", true)
    .order("total_visits", { ascending: false })
    .limit(8);

  const hero = banners?.[0];

  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-5">
      <header className="mb-5 flex items-center justify-between">
        <div className="display text-2xl text-brand">{BRAND.name}</div>
        {user.user ? (
          <Link href="/profile" className="btn-flat">
            My account
          </Link>
        ) : (
          <Link href="/auth" className="btn-brand px-4 py-2 text-sm">
            Sign in
          </Link>
        )}
      </header>

      <InstallPrompt />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border-2 border-edge bg-brand px-6 py-7 text-on-brand shadow-pop-lg">
        <div className="halo -right-10 -top-16 h-44 w-44 bg-pink" aria-hidden />
        <div className="halo -bottom-20 -left-12 h-48 w-48 bg-accent" aria-hidden />

        <div className="relative">
          <div className="eyebrow opacity-80">Free for customers</div>
          <h1 className="display mt-2 text-[38px]">
            {hero?.title ?? (
              <>
                Get rewarded
                <br />
                for <span className="tape bg-accent text-accent-ink">showing up.</span>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-[22rem] font-medium opacity-90">
            {hero?.subtitle ?? "Collect stamps at your regular spots. Ten visits, one free thing. That's it."}
          </p>
          <Link href="/explore" className="btn-accent mt-5">
            Find places near me →
          </Link>
        </div>
      </section>

      {/* Ticker — one flourish, used once */}
      <div className="my-5 overflow-hidden border-y-2 border-dashed border-line py-2.5">
        <div className="marquee" aria-hidden>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="eyebrow text-ink-2">
              {t} <span className="text-accent-ink/40 dark:text-accent">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* How it works — three real steps, so the numbering means something */}
      <section className="grid grid-cols-3 gap-2">
        {[
          { n: "1", t: "Walk in", s: "to a partner shop" },
          { n: "2", t: "Tap once", s: "staff approves it" },
          { n: "3", t: "Get a treat", s: "on the house" },
        ].map((s) => (
          <div key={s.n} className="rounded-md border-2 border-line bg-surface p-3">
            <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-edge bg-accent font-mono text-xs font-bold text-accent-ink">
              {s.n}
            </div>
            <div className="mt-2 text-sm font-extrabold leading-tight">{s.t}</div>
            <div className="text-xs font-medium text-ink-2">{s.s}</div>
          </div>
        ))}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="display text-2xl">Popular near you</h2>
          <Link href="/explore" className="text-sm font-bold text-brand underline decoration-2 underline-offset-4">
            See all
          </Link>
        </div>
        {featured && featured.length > 0 ? (
          <div className="space-y-3">
            {featured.map((r) => (
              <RestaurantCard key={r.slug} r={r} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-line bg-surface p-6 text-center">
            <div className="display text-lg">No shops here yet</div>
            <p className="mt-1 text-sm font-medium text-ink-2">Be the first business in your area.</p>
            <Link href="/auth?as=business" className="btn-brand mt-4">
              List your shop
            </Link>
          </div>
        )}
      </section>

      {/* Owner cross-sell */}
      <section className="mt-7 rounded-lg border-2 border-edge bg-accent p-5 text-accent-ink shadow-pop">
        <div className="eyebrow opacity-70">For businesses</div>
        <h3 className="display mt-1 text-2xl">{BRAND.ownerTagline}</h3>
        <p className="mt-1.5 text-sm font-semibold opacity-80">
          Stamp cards, scratch cards and a digital menu. Free QR stand shipped to your counter.
        </p>
        <Link href="/pricing" className="btn-ink mt-4">
          See pricing →
        </Link>
      </section>

      <BottomNav />
    </main>
  );
}
