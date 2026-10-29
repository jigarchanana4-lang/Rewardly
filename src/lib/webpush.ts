import webpush from "web-push";
import { isDevMode } from "@/lib/utils";

let configured = false;
function ensure(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@rewardly.example";
  if (pub && priv) {
    if (!configured) {
      webpush.setVapidDetails(subject, pub, priv);
      configured = true;
    }
    return true;
  }
  return false;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Send a push. Returns `gone: true` when the subscription is dead (prune it). */
export async function sendPush(
  sub: PushSub,
  payload: { title: string; body: string; url?: string },
): Promise<{ ok: boolean; dev: boolean; gone: boolean }> {
  if (isDevMode() || !ensure()) {
    // eslint-disable-next-line no-console
    console.log(`[push:dev] → ${sub.endpoint.slice(0, 40)}… : ${payload.title}`);
    return { ok: true, dev: true, gone: false };
  }
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true, dev: false, gone: false };
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode;
    return { ok: false, dev: false, gone: status === 404 || status === 410 };
  }
}
