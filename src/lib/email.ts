import { BRAND } from "@/config/brand";
import { isDevMode } from "@/lib/utils";

/**
 * Transactional email via Resend. In DEV_MODE or without an API key, the email
 * is logged instead of sent — so flows work without an email provider.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; dev: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`;

  if (isDevMode() || !key || !to) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev] → ${to} | ${subject}`);
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return { ok: res.ok, dev: false };
  } catch {
    return { ok: false, dev: false };
  }
}

export function receiptEmail(shopName: string, tier: string, amount: number) {
  return {
    subject: `${BRAND.name} — payment received`,
    html: `
      <div style="font-family:system-ui;max-width:520px;margin:auto">
        <h2 style="color:${BRAND.colors.brand}">Thanks for subscribing to ${BRAND.name}</h2>
        <p>Your <b>${tier}</b> plan for <b>${shopName}</b> is now active.</p>
        <p>Amount paid: <b>₹${amount.toLocaleString("en-IN")}</b> / year</p>
        <p>Your free QR stand will be shipped shortly. Manage your plan anytime from your dashboard.</p>
        <p style="color:#888;font-size:12px">This is a transactional receipt from ${BRAND.name}.</p>
      </div>`,
  };
}
