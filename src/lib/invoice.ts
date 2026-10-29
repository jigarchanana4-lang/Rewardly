import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAND } from "@/config/brand";

/**
 * GST invoice generation.
 *
 * The charged amount is treated as GST-INCLUSIVE and the tax is derived from
 * it, so every invoice reconciles exactly with what Razorpay actually took.
 * Computing tax on top would print a total the customer was never charged.
 */

export const GST_RATE = 18;
/** SAC 998314 — "information technology infrastructure and application services". */
export const SAC_CODE = "998314";

export interface TaxSplit {
  totalPaise: number;
  taxablePaise: number;
  taxPaise: number;
  /** Intra-state splits in half as CGST + SGST; inter-state is one IGST line. */
  isInterstate: boolean;
}

/** Back-calculate the taxable value from a GST-inclusive total, in paise. */
export function splitInclusive(totalPaise: number, isInterstate: boolean): TaxSplit {
  const taxablePaise = Math.round(totalPaise / (1 + GST_RATE / 100));
  return {
    totalPaise,
    taxablePaise,
    // Derive tax as the remainder so the parts always sum back to the total,
    // rather than rounding twice and being a paisa out.
    taxPaise: totalPaise - taxablePaise,
    isInterstate,
  };
}

export const paise = (rupees: number) => Math.round(rupees * 100);
export const rupees = (p: number) => p / 100;

export function formatINR(p: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees(p));
}

export interface IssueInvoiceInput {
  restaurantId: string;
  tier: string;
  amountPaise: number;
  razorpayPaymentId: string;
}

/**
 * Create an invoice for a verified payment. Idempotent on razorpay_payment_id —
 * a webhook retry must not mint a second invoice number.
 */
export async function issueInvoice(
  svc: SupabaseClient,
  input: IssueInvoiceInput,
): Promise<{ id: string; number: string } | null> {
  const { data: existing } = await svc
    .from("invoices")
    .select("id, number")
    .eq("razorpay_payment_id", input.razorpayPaymentId)
    .maybeSingle();
  if (existing) return existing as { id: string; number: string };

  const { data: rest } = await svc
    .from("restaurants")
    .select("id, name, gstin, billing_state, billing_address, address")
    .eq("id", input.restaurantId)
    .maybeSingle();
  if (!rest) return null;

  const buyerState = (rest.billing_state ?? "").trim();
  const isInterstate =
    !!buyerState && buyerState.toLowerCase() !== BRAND.gst.state.toLowerCase();

  const split = splitInclusive(input.amountPaise, isInterstate);

  const { data: fyRow } = await svc.rpc("current_financial_year");
  const fy = (fyRow as unknown as string) ?? "";
  const { data: seqRow } = await svc.rpc("next_invoice_seq", { p_fy: fy });
  const seq = Number(seqRow ?? 0);
  if (!fy || !seq) return null;

  const number = `${BRAND.gst.invoicePrefix}/${fy}/${String(seq).padStart(4, "0")}`;

  const { data, error } = await svc
    .from("invoices")
    .insert({
      restaurant_id: rest.id,
      number,
      financial_year: fy,
      seq,
      tier: input.tier,
      razorpay_payment_id: input.razorpayPaymentId,
      total_paise: split.totalPaise,
      taxable_paise: split.taxablePaise,
      tax_paise: split.taxPaise,
      gst_rate: GST_RATE,
      is_interstate: split.isInterstate,
      supplier_name: BRAND.legalEntity,
      supplier_gstin: BRAND.gst.gstin,
      supplier_state: BRAND.gst.state,
      buyer_name: rest.name,
      buyer_gstin: rest.gstin,
      buyer_state: buyerState || null,
      buyer_address: rest.billing_address ?? rest.address,
      sac_code: SAC_CODE,
    })
    .select("id, number")
    .single();

  if (error) return null;
  return data as { id: string; number: string };
}
