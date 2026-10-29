"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Audience = "all" | "near_reward" | "inactive";

const SEGMENTS: { id: Audience; label: string; hint: string }[] = [
  { id: "all", label: "All customers", hint: "Everyone with a card" },
  { id: "near_reward", label: "Near a reward", hint: "About to earn a treat" },
  { id: "inactive", label: "Gone quiet", hint: "No visit in 3 weeks" },
];

const PRESETS: Record<Audience, string> = {
  all: "Hi {name}! New rewards just dropped at {shop}. Come collect a stamp this week 🎁",
  near_reward: "Hi {name}, you're so close to a free reward at {shop}! Pop in for your next stamp ⭐",
  inactive: "We miss you at {shop}, {name}! Here's a nudge to come earn your next reward 💚",
};

export default function CampaignComposer({
  restaurantId,
  shopName,
  counts,
}: {
  restaurantId: string;
  shopName: string;
  counts: Record<Audience, number>;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("all");
  const [name, setName] = useState("");
  const [body, setBody] = useState(PRESETS.all);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ recipients: number; sent: number; dev: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(a: Audience) {
    setAudience(a);
    if (!name.trim() || Object.values(PRESETS).includes(body)) setBody(PRESETS[a]);
    setResult(null);
  }

  async function send() {
    setError(null);
    if (!name.trim()) return setError("Give the campaign a name.");
    if (!body.trim()) return setError("Write a message.");
    if (counts[audience] === 0) return setError("No customers in this segment yet.");
    setBusy(true);
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, name, body, audience }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Send failed");
    setResult(data);
    router.refresh();
  }

  const preview = body.replace(/\{name\}/gi, "Priya").replace(/\{shop\}/gi, shopName);

  return (
    <div className="mt-6 space-y-4">
      <div>
        <span className="label">Audience</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              className={`rounded-2xl border p-3 text-left transition ${
                audience === s.id ? "border-brand bg-brand-soft" : "border-line bg-surface"
              }`}
            >
              <div className="text-lg font-extrabold tabular-nums">{counts[s.id]}</div>
              <div className="text-xs font-semibold">{s.label}</div>
              <div className="text-[11px] text-ink-2">{s.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="label">Campaign name</span>
        <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend nudge" />
      </label>

      <label className="block">
        <span className="label">Message</span>
        <textarea
          className="field mt-1 min-h-24"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="mt-1 block text-xs text-ink-2">
          Use <code className="font-mono">{"{name}"}</code> and <code className="font-mono">{"{shop}"}</code> to personalise.
        </span>
      </label>

      <div className="rounded-2xl bg-[#e5ffd8] p-3 text-sm text-[#14361a]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">WhatsApp preview</div>
        {preview}
      </div>

      {error && <p className="text-sm text-risk">{error}</p>}
      {result && (
        <p className="rounded-2xl bg-good-soft p-3 text-sm text-good">
          {result.dev
            ? `Simulated (DEV): ${result.sent}/${result.recipients} logged. Add WhatsApp creds to send for real.`
            : `Sent to ${result.sent} of ${result.recipients} customers.`}
        </p>
      )}

      <button className="btn-brand w-full" disabled={busy} onClick={send}>
        {busy ? "Sending…" : `Send to ${counts[audience]} customer${counts[audience] === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
