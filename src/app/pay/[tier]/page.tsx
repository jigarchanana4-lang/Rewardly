import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIERS, TierId } from "@/config/brand";
import CheckoutButton from "@/components/CheckoutButton";
import { inr } from "@/lib/utils";

export function generateMetadata({ params }: { params: { tier: string } }) {
  const t = TIERS[params.tier as TierId];
  return { title: t ? `Checkout — ${t.name}` : "Checkout" };
}

export default async function PayPage({ params }: { params: { tier: string } }) {
  const tier = TIERS[params.tier as TierId];
  if (!tier) notFound();

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth?as=business&next=/pay/${tier.id}`);

  const { data: r } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!r) redirect("/onboarding/owner");

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="text-center">
        <div className="chip mx-auto bg-good-soft text-good">Discount applied</div>
        <h1 className="mt-3 text-lg font-semibold text-ink-2">
          Buy now — stamp card, scratch card &amp; menu
        </h1>
        <div className="mt-2 text-ink-2 line-through">{inr(tier.anchor)}</div>
        <div className="text-5xl font-extrabold">{inr(tier.price)}</div>
        <div className="text-ink-2">per year</div>
      </div>

      <div className="card mt-6">
        <Row label={`${tier.name} annual plan`} value={inr(tier.price)} />
        <Row label="QR stand" value="FREE" valueClass="text-good font-bold" />
        <div className="my-2 border-t border-line" />
        <Row label="Total" value={inr(tier.price)} bold />
      </div>

      <div className="mt-6">
        <CheckoutButton restaurantId={r.id} tier={tier.id} label={`Pay ${inr(tier.price)}`} />
      </div>
      <p className="mt-3 text-center text-xs text-ink-2">
        🔒 Razorpay secure checkout · Cancel anytime
      </p>
    </main>
  );
}

function Row({
  label,
  value,
  bold,
  valueClass = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={bold ? "font-bold" : "text-ink-2"}>{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${valueClass}`}>{value}</span>
    </div>
  );
}
