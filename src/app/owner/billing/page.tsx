import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accessFromSub } from "@/lib/subscription";
import { formatINR } from "@/lib/invoice";
import BillingCard from "@/components/BillingCard";
import CreditsCard from "@/components/CreditsCard";
import GstDetailsForm from "@/components/GstDetailsForm";
import type { Restaurant, Subscription } from "@/lib/types";

export const metadata = { title: "Billing & invoices" };

export default async function BillingPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/billing");

  const { data: r } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", auth.user.id)
    .maybeSingle<Restaurant>();
  if (!r) redirect("/onboarding/owner");

  const [{ data: sub }, { data: invoices }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("restaurant_id", r.id).maybeSingle<Subscription>(),
    supabase
      .from("invoices")
      .select("id, number, issued_at, tier, total_paise")
      .eq("restaurant_id", r.id)
      .order("issued_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-3xl">
      <Link href="/owner" className="text-sm font-bold text-brand underline decoration-2 underline-offset-4 lg:hidden">
        ← Dashboard
      </Link>
      <div className="label mt-2">{r.name}</div>
      <h1 className="display mt-1 text-[34px]">Billing</h1>

      <div className="mt-6">
        <BillingCard restaurantId={r.id} tier={sub?.tier ?? null} access={accessFromSub(sub)} />
      </div>

      <section className="mt-8">
        <CreditsCard credits={r.credits} />
      </section>

      <section className="mt-8">
        <h2 className="display mb-2 text-xl">GST details</h2>
        <p className="mb-3 text-sm font-medium text-ink-2">
          Added to every future invoice so you can claim input credit. Your state decides whether GST
          appears as CGST + SGST or as IGST.
        </p>
        <GstDetailsForm
          restaurantId={r.id}
          initialGstin={r.gstin}
          initialState={r.billing_state}
          initialAddress={r.billing_address ?? r.address}
        />
      </section>

      <section className="mt-8">
        <h2 className="display mb-2 text-xl">Invoices</h2>
        {invoices && invoices.length > 0 ? (
          <ul className="space-y-2">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/owner/invoice/${i.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border-2 border-line bg-surface px-4 py-3 transition hover:border-edge hover:shadow-pop"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-bold">{i.number}</div>
                    <div className="text-xs font-medium capitalize text-ink-2">
                      {i.tier} plan · {new Date(i.issued_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums">{formatINR(i.total_paise)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-line bg-surface p-6 text-center">
            <div className="font-bold">No invoices yet</div>
            <p className="mt-1 text-sm font-medium text-ink-2">
              A GST invoice is issued automatically on your first payment.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
