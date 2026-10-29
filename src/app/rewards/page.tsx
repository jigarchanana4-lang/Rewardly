import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import ReferralCard from "@/components/ReferralCard";

export const metadata = { title: "My rewards" };

export default async function RewardsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?next=/rewards");

  const { data: rewards } = await supabase
    .from("claimed_rewards")
    .select("id, reward_title, reward_description, status, code, expires_at, restaurant_id, restaurants:restaurant_id(name, slug)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", auth.user.id)
    .maybeSingle();

  const { count: referredCount } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", auth.user.id);

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <div className="label">Your wallet</div>
      <h1 className="display mt-1 text-[34px]">My rewards</h1>

      {profile?.referral_code && (
        <div className="mt-4">
          <ReferralCard code={profile.referral_code} referredCount={referredCount ?? 0} />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {rewards && rewards.length > 0 ? (
          rewards.map((rw) => {
            const shop = one<{ name: string; slug: string }>(rw.restaurants);
            const redeemed = rw.status === "redeemed";
            return (
              <div
                key={rw.id}
                className={
                  redeemed
                    ? "rounded-lg border-2 border-line bg-surface p-5 opacity-60"
                    : "ticket p-0"
                }
              >
                <div className={redeemed ? "" : "px-5 pb-4 pt-5"}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="label truncate">{shop?.name ?? "Reward"}</span>
                    <span className={redeemed ? "chip-soft" : "chip-accent"}>
                      {redeemed ? "Redeemed" : "Ready"}
                    </span>
                  </div>
                  <div className="display mt-1.5 text-2xl">{rw.reward_title}</div>
                  {rw.reward_description && (
                    <div className="mt-0.5 text-sm font-medium text-ink-2">{rw.reward_description}</div>
                  )}
                </div>

                {!redeemed && (
                  <>
                    <div className="perf" />
                    <div className="px-5 pb-5 pt-6 text-center">
                      <div className="label">Show this code to staff</div>
                      <div className="mt-1.5 font-mono text-[32px] font-medium tracking-[0.2em] text-brand">
                        {rw.code}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border-2 border-dashed border-line bg-surface p-8 text-center">
            <div className="display text-xl">Nothing here yet</div>
            <p className="mt-1.5 text-sm font-medium text-ink-2">
              Collect stamps at your favourite shops and your treats show up here.
            </p>
            <Link href="/explore" className="btn-brand mt-4">
              Find shops near me
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
