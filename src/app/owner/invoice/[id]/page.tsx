import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatINR, GST_RATE } from "@/lib/invoice";
import { BRAND } from "@/config/brand";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Tax invoice" };

/** Printable GST invoice. RLS restricts SELECT to the owning business. */
export default async function InvoicePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth?as=business&next=/owner/invoice/${params.id}`);

  const { data: inv } = await supabase.from("invoices").select("*").eq("id", params.id).maybeSingle();
  if (!inv) notFound();

  const half = Math.round(inv.tax_paise / 2);
  // Give any odd paisa to CGST so the two halves sum back to the tax exactly.
  const taxRows = inv.is_interstate
    ? [{ label: `IGST @ ${GST_RATE}%`, amount: inv.tax_paise }]
    : [
        { label: `CGST @ ${GST_RATE / 2}%`, amount: inv.tax_paise - half },
        { label: `SGST @ ${GST_RATE / 2}%`, amount: half },
      ];

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/owner/billing" className="text-sm font-bold text-brand underline decoration-2 underline-offset-4">
          ← Billing
        </Link>
        <PrintButton />
      </div>

      <div className="mt-5 rounded-lg border-2 border-edge bg-surface p-7 print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow text-brand">Tax invoice</div>
            <div className="display mt-1 text-2xl">{inv.number}</div>
            <div className="mt-0.5 text-sm font-medium text-ink-2">
              Issued {new Date(inv.issued_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="display text-lg">{inv.supplier_name}</div>
            {inv.supplier_gstin ? (
              <div className="font-mono text-xs text-ink-2">GSTIN {inv.supplier_gstin}</div>
            ) : (
              <div className="text-xs font-semibold text-warn">GSTIN not configured</div>
            )}
            {inv.supplier_state && <div className="text-xs text-ink-2">{inv.supplier_state}</div>}
          </div>
        </div>

        <div className="mt-6 rounded-md border-2 border-line bg-surface-2 p-4">
          <div className="label">Billed to</div>
          <div className="mt-0.5 font-extrabold">{inv.buyer_name}</div>
          {inv.buyer_address && <div className="text-sm text-ink-2">{inv.buyer_address}</div>}
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-2">
            {inv.buyer_gstin && <span className="font-mono">GSTIN {inv.buyer_gstin}</span>}
            {inv.buyer_state && <span>Place of supply: {inv.buyer_state}</span>}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-line text-left">
              <th className="pb-2 font-bold">Description</th>
              <th className="pb-2 text-right font-bold">SAC</th>
              <th className="pb-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-3">
                <div className="font-bold capitalize">{inv.tier} plan — annual subscription</div>
                <div className="text-xs text-ink-2">{BRAND.name} digital loyalty platform</div>
              </td>
              <td className="py-3 text-right font-mono text-xs">{inv.sac_code}</td>
              <td className="py-3 text-right font-mono tabular-nums">{formatINR(inv.taxable_paise)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 space-y-1.5 text-sm">
          <Row label="Taxable value" value={formatINR(inv.taxable_paise)} />
          {taxRows.map((t) => (
            <Row key={t.label} label={t.label} value={formatINR(t.amount)} />
          ))}
          <div className="mt-2 flex items-center justify-between border-t-2 border-edge pt-2.5">
            <span className="display text-lg">Total paid</span>
            <span className="display text-lg tabular-nums">{formatINR(inv.total_paise)}</span>
          </div>
        </div>

        <p className="mt-6 text-xs text-ink-2">
          Amount charged is inclusive of GST at {GST_RATE}%. This is a computer-generated invoice and
          does not require a signature. Questions: {BRAND.supportEmail}
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
