import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OwnerScanFeed from "@/components/OwnerScanFeed";
import QRCodeCard from "@/components/QRCodeCard";
import BillingCard from "@/components/BillingCard";
import SetupChecklist from "@/components/SetupChecklist";
import RedeemButton from "@/components/RedeemButton";
import { one } from "@/lib/utils";
import { accessFromSub } from "@/lib/subscription";
import type { Restaurant, Subscription } from "@/lib/types";

export const metadata = { title: "Business dashboard" };

export default async function OwnerDashboard() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner");

  const { data: r } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", auth.user.id)
    .maybeSingle<Restaurant>();

  if (!r) redirect("/onboarding/owner");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", r.id)
    .maybeSingle<Subscription>();

  const [{ count: customers }, { count: rewardsGiven }, { data: pendingRewards }, { count: menuCount }] =
    await Promise.all([
      supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
      supabase.from("claimed_rewards").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
      supabase
        .from("claimed_rewards")
        .select("id, reward_title, code, status, profiles:user_id(full_name)")
        .eq("restaurant_id", r.id)
        .eq("status", "pending")
        .limit(10),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const scanUrl = `${siteUrl}/scan/${r.id}`;
  const access = accessFromSub(sub);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-6 lg:max-w-6xl lg:px-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Business dashboard</div>
          <h1 className="display mt-0.5 truncate text-[28px]">{r.name}</h1>
          <Link
            href={`/shop/${r.slug}`}
            className="text-sm font-bold text-brand underline decoration-2 underline-offset-4"
          >
            View public page →
          </Link>
        </div>
        <span
          className={`chip shrink-0 capitalize ${
            access.active ? "border-edge bg-good text-white" : "border-risk bg-risk-soft text-risk"
          }`}
        >
          {access.state}
        </span>
      </header>

      {!access.active && (
        <div className="mb-5 rounded-lg border-2 border-risk bg-risk-soft p-4">
          <div className="display text-lg text-risk">
            {access.state === "expired" ? "Your plan has expired" : "No active plan"}
          </div>
          <p className="mt-1 text-sm font-medium text-ink-2">
            Your shop is hidden from customers until you choose a plan. Reactivate in seconds.
          </p>
          <Link href="/pricing" className="btn-brand mt-3">
            Choose a plan
          </Link>
        </div>
      )}

      <SetupChecklist
        items={[
          { label: "Add your reward & logo", done: !!r.logo_url, href: "/owner/settings" },
          { label: "Add your menu", done: (menuCount ?? 0) > 0, href: "/owner/menu" },
          { label: "Put out your QR code", done: r.total_visits > 0, href: "/owner" },
          { label: "Set up your Review QR", done: !!r.google_review_url, href: "/owner/review-qr" },
          { label: "Give your first stamp", done: (customers ?? 0) > 0, href: "/owner" },
        ]}
      />

      <div className="mb-6 grid grid-cols-3 gap-2.5 lg:max-w-xl">
        <Stat label="Visits" value={r.total_visits} tone="brand" />
        <Stat label="Customers" value={customers ?? 0} tone="pink" />
        <Stat label="Rewards" value={rewardsGiven ?? 0} tone="accent" />
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        {/* Primary column — the live counter workflow */}
        <div className="space-y-6 lg:col-span-2">
          <OwnerScanFeed restaurantId={r.id} rewardMode={r.reward_mode} />

          {pendingRewards && pendingRewards.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="display text-xl">Rewards to redeem</h2>
                <span className="chip-accent font-mono tabular-nums">{pendingRewards.length}</span>
              </div>
              <ul className="space-y-2">
                {pendingRewards.map((rw) => (
                  <li
                    key={rw.id}
                    className="flex items-center justify-between gap-3 rounded-lg border-2 border-edge bg-surface p-4 shadow-pop"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">
                        {one<{ full_name?: string }>(rw.profiles)?.full_name || "Customer"}
                      </div>
                      <div className="truncate text-sm font-medium text-ink-2">{rw.reward_title}</div>
                    </div>
                    <RedeemButton rewardId={rw.id} code={rw.code} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-medium text-ink-2">
                Check the code the customer shows matches, tap Redeem, hand over the reward.
              </p>
            </section>
          )}
        </div>

        {/* Secondary column — QR + billing */}
        <div className="mt-6 space-y-6 lg:mt-0">
          <QRCodeCard url={scanUrl} name={r.slug} />
          <BillingCard restaurantId={r.id} tier={sub?.tier ?? null} access={access} />
        </div>
      </div>

      {/* Mobile-only quick nav (desktop uses the sidebar) */}
      <section className="mt-6 grid grid-cols-2 gap-2 lg:hidden">
        <Link href="/owner/analytics" className="btn-ghost">
          Analytics
        </Link>
        <Link href="/owner/campaigns" className="btn-ghost">
          Campaigns
        </Link>
        <Link href="/owner/menu" className="btn-ghost">
          Menu
        </Link>
        <Link href="/owner/photos" className="btn-ghost">
          Photos
        </Link>
        <Link href="/owner/review-qr" className="btn-ghost">
          Review QR
        </Link>
        <Link href="/owner/billing" className="btn-ghost">
          Billing
        </Link>
        <Link href="/owner/settings" className="btn-ghost">
          Settings
        </Link>
      </section>
    </main>
  );
}

const TONES = {
  brand: "bg-brand text-on-brand",
  pink: "bg-pink text-white",
  accent: "bg-accent text-accent-ink",
} as const;

function Stat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-lg border-2 border-edge p-3 shadow-pop ${TONES[tone]}`}>
      <div className="display text-3xl tabular-nums">{value}</div>
      <div className="eyebrow mt-0.5 opacity-70">{label}</div>
    </div>
  );
}
