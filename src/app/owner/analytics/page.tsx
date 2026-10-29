import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";

export const metadata = { title: "Analytics" };

const DAY = 864e5;

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/analytics");

  const { data: r } = await supabase
    .from("restaurants")
    .select("id, name, total_visits, stamps_required")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!r) redirect("/onboarding/owner");

  const now = Date.now();
  const d30 = new Date(now - 30 * DAY).toISOString();

  const [
    { count: customers },
    { count: returning },
    { count: rewardsIssued },
    { count: rewardsRedeemed },
    { count: newCustomers30 },
    { data: topCards },
    { count: scans30 },
    { count: campaigns },
  ] = await Promise.all([
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).gt("total_visits", 1),
    supabase.from("claimed_rewards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    supabase.from("claimed_rewards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).eq("status", "redeemed"),
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).gte("created_at", d30),
    supabase
      .from("loyalty_cards")
      .select("total_visits, current_stamps, profiles:user_id(full_name)")
      .eq("restaurant_id", r.id)
      .order("total_visits", { ascending: false })
      .limit(5),
    supabase.from("scan_events").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).eq("status", "approved").gte("created_at", d30),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
  ]);

  const total = customers ?? 0;
  const returningRate = total ? Math.round(((returning ?? 0) / total) * 100) : 0;
  const redemptionRate = rewardsIssued ? Math.round(((rewardsRedeemed ?? 0) / rewardsIssued) * 100) : 0;

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6 lg:max-w-4xl lg:px-8">
      <Link href="/owner" className="text-sm text-brand lg:hidden">
        ← Dashboard
      </Link>
      <div className="label mt-2">{r.name}</div>
      <h1 className="display mt-1 text-[34px]">Analytics</h1>

      <div className="relative mt-5 overflow-hidden rounded-lg border-2 border-edge bg-brand p-5 text-on-brand shadow-pop">
        <div className="halo -right-8 -top-12 h-32 w-32 bg-pink" aria-hidden />
        <div className="relative">
          <div className="eyebrow opacity-70">Your impact</div>
          <p className="display mt-1.5 text-xl leading-snug">
            {returning ?? 0} customer{(returning ?? 0) === 1 ? " has" : "s have"} come back for more, and
            you&rsquo;ve handed out {rewardsRedeemed ?? 0} reward{(rewardsRedeemed ?? 0) === 1 ? "" : "s"}.
          </p>
          <p className="mt-2 text-sm font-semibold opacity-85">
            {returningRate}% of your customers return — that&rsquo;s the loyalty working.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Stat label="Total customers" value={total} />
        <Stat label="New (30d)" value={newCustomers30 ?? 0} />
        <Stat label="Returning rate" value={`${returningRate}%`} hint="visited more than once" />
        <Stat label="Redemption rate" value={`${redemptionRate}%`} hint="rewards claimed → redeemed" />
        <Stat label="Stamps (30d)" value={scans30 ?? 0} />
        <Stat label="Campaigns sent" value={campaigns ?? 0} />
      </div>

      <section className="mt-7">
        <h2 className="display mb-2.5 text-xl">Top customers</h2>
        {topCards && topCards.length > 0 ? (
          <ul className="space-y-2">
            {topCards.map((c, i) => {
              const p = one<{ full_name?: string }>(c.profiles);
              return (
                <li key={i} className="flex items-center gap-3 rounded-md border-2 border-line bg-surface px-4 py-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-edge font-mono text-xs font-bold ${
                      i === 0 ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{p?.full_name || "Customer"}</span>
                  <span className="shrink-0 font-mono text-sm text-ink-2 tabular-nums">
                    {c.total_visits} visits
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-line bg-surface p-6 text-center">
            <div className="font-bold">No customer activity yet</div>
            <p className="mt-1 text-sm font-medium text-ink-2">
              Your first stamps will show up here within minutes.
            </p>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border-2 border-line bg-surface p-5">
        <h2 className="display text-xl">Your data</h2>
        <p className="mt-1 text-sm font-medium text-ink-2">
          Download your customer list as a spreadsheet. It&rsquo;s your data — take it with you any
          time.
        </p>
        <a href="/api/owner/export" className="btn-ghost mt-3 inline-flex" download>
          Export customers (CSV)
        </a>
      </section>

      <p className="mt-7 text-center text-xs font-medium text-ink-2">
        Deeper cohort retention &amp; churn signals land on the Pro plan next.
      </p>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-md border-2 border-line bg-surface p-3.5">
      <div className="display text-3xl tabular-nums">{value}</div>
      <div className="label mt-0.5">{label}</div>
      {hint && <div className="mt-1 text-[11px] font-medium text-ink-2">{hint}</div>}
    </div>
  );
}
