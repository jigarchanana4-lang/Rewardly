import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignComposer from "@/components/CampaignComposer";
import PushBroadcast from "@/components/PushBroadcast";
import type { Restaurant } from "@/lib/types";

export const metadata = { title: "WhatsApp campaigns" };

const INACTIVE_DAYS = 21;
const NEAR_REWARD_GAP = 2;

export default async function CampaignsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/campaigns");

  const { data: r } = await supabase
    .from("restaurants")
    .select("id, name, stamps_required")
    .eq("owner_id", auth.user.id)
    .maybeSingle<Pick<Restaurant, "id" | "name" | "stamps_required">>();
  if (!r) redirect("/onboarding/owner");

  const cutoff = new Date(Date.now() - INACTIVE_DAYS * 864e5).toISOString();
  const [all, near, inactive, { data: history }] = await Promise.all([
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    supabase
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id)
      .gte("current_stamps", Math.max(1, r.stamps_required - NEAR_REWARD_GAP)),
    supabase
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id)
      .lt("updated_at", cutoff),
    supabase
      .from("campaigns")
      .select("id, name, audience, recipients, sent, failed, sent_at")
      .eq("restaurant_id", r.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const counts = {
    all: all.count ?? 0,
    near_reward: near.count ?? 0,
    inactive: inactive.count ?? 0,
  };

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-3xl">
      <Link href="/owner" className="text-sm text-brand lg:hidden">
        ← Dashboard
      </Link>
      <h1 className="mt-2 display text-2xl">WhatsApp campaigns</h1>
      <p className="mt-1 text-ink-2">Bring customers back with a message that lands where they already are.</p>

      <CampaignComposer restaurantId={r.id} shopName={r.name} counts={counts} />

      <PushBroadcast restaurantId={r.id} />

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-bold">Recent campaigns</h2>
        {history && history.length > 0 ? (
          <ul className="space-y-2">
            {history.map((c) => (
              <li key={c.id} className="card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.name}</span>
                  <span className="chip-soft capitalize">{c.audience.replace("_", " ")}</span>
                </div>
                <div className="mt-1 text-sm text-ink-2 tabular-nums">
                  {c.sent}/{c.recipients} delivered
                  {c.failed ? ` · ${c.failed} failed` : ""}
                  {c.sent_at ? ` · ${new Date(c.sent_at).toLocaleDateString()}` : ""}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card text-center text-ink-2">No campaigns yet.</div>
        )}
      </section>
    </main>
  );
}
