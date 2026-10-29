"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ImageUpload";
import type { Restaurant } from "@/lib/types";

type Prize = { label: string; weight: number };

export default function OwnerSettingsForm({ restaurant }: { restaurant: Restaurant }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    name: restaurant.name,
    category: restaurant.category ?? "cafe",
    address: restaurant.address ?? "",
    phone: restaurant.phone ?? "",
    logo_url: restaurant.logo_url ?? "",
    stamps_required: restaurant.stamps_required,
    auto_approve: restaurant.auto_approve ?? false,
    reward_mode: restaurant.reward_mode ?? "stamps",
    points_per_rupee: restaurant.points_per_rupee ?? 1,
    points_threshold: restaurant.points_threshold ?? 100,
    reward_title: restaurant.reward_title ?? "",
    reward_description: restaurant.reward_description ?? "",
    reward_image_url: restaurant.reward_image_url ?? "",
    google_review_url: restaurant.google_review_url ?? "",
    google_review_text: restaurant.google_review_text ?? "",
    scratch_enabled: restaurant.scratch_enabled,
    is_active: restaurant.is_active,
  });
  const [prizes, setPrizes] = useState<Prize[]>(
    Array.isArray(restaurant.scratch_prizes) && restaurant.scratch_prizes.length
      ? restaurant.scratch_prizes
      : [{ label: "10% off", weight: 60 }, { label: "Free item", weight: 40 }],
  );
  const [socials, setSocials] = useState({
    instagram: restaurant.social_links?.instagram ?? "",
    facebook: restaurant.social_links?.facebook ?? "",
    whatsapp: restaurant.social_links?.whatsapp ?? "",
    website: restaurant.social_links?.website ?? "",
  });
  const [hours, setHours] = useState<Record<string, string>>(restaurant.hours ?? {});
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const set = (k: string, v: string | number | boolean) => {
    setF((s) => ({ ...s, [k]: v }));
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("restaurants")
      .update({
        ...f,
        scratch_prizes: prizes.filter((p) => p.label.trim()),
        social_links: Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim())),
        hours: Object.fromEntries(Object.entries(hours).filter(([, v]) => v.trim())),
      })
      .eq("id", restaurant.id);
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-6">
      <fieldset className="space-y-3">
        <legend className="label mb-1">Business</legend>
        <Text label="Name" value={f.name} onChange={(v) => set("name", v)} />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={f.category}
            onChange={(v) => set("category", v)}
            options={["cafe", "restaurant", "bakery", "salon", "gym", "bar", "other"]}
          />
          <Text label="Phone" value={f.phone} onChange={(v) => set("phone", v)} />
        </div>
        <Text label="Address" value={f.address} onChange={(v) => set("address", v)} />
        <ImageUpload label="Logo" value={f.logo_url} onChange={(v) => set("logo_url", v)} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="label mb-1">Reward programme</legend>
        <Select
          label="Mode"
          value={f.reward_mode}
          onChange={(v) => set("reward_mode", v)}
          options={["stamps", "points"]}
        />
        {f.reward_mode === "stamps" ? (
          <>
            <Number label="Stamps required" value={f.stamps_required} min={1} max={30} onChange={(v) => set("stamps_required", v)} />
            <div className="flex items-center justify-between rounded-md border-2 border-line bg-surface-2 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Fast mode</div>
                <div className="text-xs text-ink-2">Stamps add instantly — no approval tap. Great for busy counters.</div>
              </div>
              <Toggle checked={f.auto_approve} onChange={(v) => set("auto_approve", v)} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Number label="Points per ₹1" value={f.points_per_rupee} min={0} onChange={(v) => set("points_per_rupee", v)} />
            <Number label="Points for reward" value={f.points_threshold} min={1} onChange={(v) => set("points_threshold", v)} />
          </div>
        )}
        <Text label="Reward title" value={f.reward_title} onChange={(v) => set("reward_title", v)} placeholder="Free coffee" />
        <Text label="Reward description" value={f.reward_description} onChange={(v) => set("reward_description", v)} />
        <ImageUpload label="Reward image" value={f.reward_image_url} onChange={(v) => set("reward_image_url", v)} shape="wide" />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="label mb-1 flex items-center justify-between">
          <span>Scratch card</span>
          <Toggle checked={f.scratch_enabled} onChange={(v) => set("scratch_enabled", v)} />
        </legend>
        {f.scratch_enabled && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2">Prizes are drawn by weight. Higher weight = more likely.</p>
            {prizes.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="field flex-1"
                  placeholder="Prize label"
                  value={p.label}
                  onChange={(e) => {
                    const next = [...prizes];
                    next[i] = { ...p, label: e.target.value };
                    setPrizes(next);
                  }}
                />
                <input
                  type="number"
                  min={1}
                  className="field w-20"
                  value={p.weight}
                  onChange={(e) => {
                    const next = [...prizes];
                    next[i] = { ...p, weight: globalThis.Number(e.target.value) };
                    setPrizes(next);
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost px-3 text-risk"
                  onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => setPrizes([...prizes, { label: "", weight: 20 }])}
            >
              + Add prize
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="label mb-1">Google reviews</legend>
        <Text label="Review link" value={f.google_review_url} onChange={(v) => set("google_review_url", v)} placeholder="https://g.page/…/review" />
        <Text label="Prompt text" value={f.google_review_text} onChange={(v) => set("google_review_text", v)} placeholder="Loved it? Leave us a review!" />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="label mb-1">Social links</legend>
        <Text label="Instagram" value={socials.instagram} onChange={(v) => { setSocials((s) => ({ ...s, instagram: v })); setSaved(false); }} placeholder="https://instagram.com/…" />
        <Text label="Facebook" value={socials.facebook} onChange={(v) => { setSocials((s) => ({ ...s, facebook: v })); setSaved(false); }} placeholder="https://facebook.com/…" />
        <Text label="WhatsApp" value={socials.whatsapp} onChange={(v) => { setSocials((s) => ({ ...s, whatsapp: v })); setSaved(false); }} placeholder="https://wa.me/91…" />
        <Text label="Website" value={socials.website} onChange={(v) => { setSocials((s) => ({ ...s, website: v })); setSaved(false); }} placeholder="https://…" />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label mb-1">Opening hours</legend>
        {DAYS.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-10 text-sm font-semibold">{d}</span>
            <input
              className="field flex-1"
              value={hours[d] ?? ""}
              onChange={(e) => { setHours((h) => ({ ...h, [d]: e.target.value })); setSaved(false); }}
              placeholder="9:00–18:00 or Closed"
            />
          </div>
        ))}
      </fieldset>

      <fieldset className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Listing active</div>
          <div className="text-xs text-ink-2">Show this business in Explore.</div>
        </div>
        <Toggle checked={f.is_active} onChange={(v) => set("is_active", v)} />
      </fieldset>

      {error && <p className="text-sm text-risk">{error}</p>}

      <div className="sticky bottom-4">
        <button className="btn-brand w-full" disabled={busy}>
          {busy ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field mt-1" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Number({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className="field mt-1"
        value={value}
        onChange={(e) => onChange(globalThis.Number(e.target.value))}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field mt-1 capitalize" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o} className="capitalize">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-brand" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}
