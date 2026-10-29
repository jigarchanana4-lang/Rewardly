import { isDevMode } from "@/lib/utils";

const GRAPH = "https://graph.facebook.com/v20.0";

/**
 * Send a proactive WhatsApp message via Cloud API.
 *
 * WhatsApp requires an APPROVED TEMPLATE for business-initiated (broadcast)
 * messages outside the 24-hour customer service window. We map the composed
 * text into a single body parameter of the configured template.
 *
 * In DEV_MODE, or when credentials/template aren't configured, this logs the
 * message instead of sending — so campaigns work end-to-end without Meta setup.
 */
export async function sendBroadcast(
  to: string,
  message: string,
): Promise<{ ok: boolean; dev: boolean; status?: number }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const lang = process.env.WHATSAPP_LANG || "en";

  if (isDevMode() || !token || !phoneId || !template) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:dev] → ${to}: ${message}`);
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template,
          language: { code: lang },
          components: [{ type: "body", parameters: [{ type: "text", text: message }] }],
        },
      }),
    });
    return { ok: res.ok, dev: false, status: res.status };
  } catch {
    return { ok: false, dev: false };
  }
}

/** Replace {name} / {shop} placeholders in a campaign body. */
export function personalize(body: string, name: string | null, shop: string): string {
  return body.replace(/\{name\}/gi, name || "there").replace(/\{shop\}/gi, shop);
}
