"use client";

import { useState } from "react";

/** Owner sends an in-app (web-push) notification to subscribed customers. */
export default function PushBroadcast({ restaurantId }: { restaurantId: string }) {
  const [title, setTitle] = useState("New reward at our shop 🎁");
  const [body, setBody] = useState("Pop in this week to collect a stamp!");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, title, body }),
    });
    const data = await res.json();
    setBusy(false);
    setResult(res.ok ? `Sent to ${data.sent}/${data.recipients}${data.dev ? " (DEV log)" : ""}` : data.error);
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-bold">App notification (push)</h2>
      <div className="card space-y-3">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea className="field min-h-16" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" />
        <button className="btn-ghost w-full" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send push to subscribers"}
        </button>
        {result && <p className="text-center text-sm text-ink-2">{result}</p>}
      </div>
    </section>
  );
}
