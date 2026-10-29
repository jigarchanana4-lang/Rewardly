"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { DEFAULT_STAMPS_REQUIRED, TRIAL_DAYS } from "@/config/brand";
import StampCardView from "@/components/StampCardView";

const CATEGORIES = ["cafe", "restaurant", "bakery", "salon", "gym", "bar", "other"];

/** A few sensible starting rewards so nobody stares at an empty field. */
const REWARD_IDEAS = ["Free coffee", "1 free haircut", "Free dessert", "20% off next visit"];

export default function OwnerOnboardingForm() {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "cafe",
    address: "",
    phone: "",
    stamps_required: DEFAULT_STAMPS_REQUIRED,
    reward_title: "Free reward on completion",
  });

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      return setError("Please sign in again.");
    }

    // ensure unique slug
    const base = slugify(form.name) || "shop";
    let slug = base;
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabase.from("restaurants").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
    }

    const { data: rest, error: insErr } = await supabase
      .from("restaurants")
      .insert({
        owner_id: auth.user.id,
        name: form.name,
        slug,
        category: form.category,
        address: form.address,
        phone: form.phone,
        stamps_required: form.stamps_required,
        reward_title: form.reward_title,
      })
      .select("id")
      .single();

    if (insErr) {
      setBusy(false);
      return setError(insErr.message);
    }

    // mark profile/role
    await supabase.from("profiles").update({ has_restaurant: true }).eq("id", auth.user.id);
    await supabase.from("user_roles").update({ role: "owner" }).eq("user_id", auth.user.id);

    // start a free trial, with a few credits so the photo studio can be tried
    // before any money changes hands
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString();
    await supabase
      .from("subscriptions")
      .insert({ restaurant_id: rest.id, tier: "basic", status: "trial", trial_end: trialEnd });

    // A few credits so the photo studio can be tried before any money changes
    // hands. Granted through the API because balance changes are server-side
    // only — the client cannot write its own credits.
    await fetch("/api/credits/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rest.id }),
    }).catch(() => {});

    router.push("/owner");
    router.refresh();
  }

  return (
    <div className="mt-8 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label" htmlFor="name">
            Business name
          </label>
          <input
            id="name"
            className="field mt-1.5"
            placeholder="Bombay Brew Co."
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Category</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("category", c)}
                className={`chip capitalize transition ${
                  form.category === c
                    ? "border-edge bg-brand text-on-brand"
                    : "border-line bg-surface text-ink-2 hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              inputMode="numeric"
              className="field mt-1.5 font-mono"
              placeholder="98765 43210"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="stamps">
              Stamps for reward
            </label>
            <input
              id="stamps"
              type="number"
              min={1}
              max={30}
              className="field mt-1.5 font-mono"
              value={form.stamps_required}
              onChange={(e) => set("stamps_required", globalThis.Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">
            Address
          </label>
          <input
            id="address"
            className="field mt-1.5"
            placeholder="Shop 4, Linking Road, Bandra"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="reward">
            Reward customers earn
          </label>
          <input
            id="reward"
            className="field mt-1.5"
            value={form.reward_title}
            onChange={(e) => set("reward_title", e.target.value)}
            placeholder="e.g. Free coffee of your choice"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {REWARD_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => set("reward_title", idea)}
                className="chip border-dashed border-line bg-surface-2 text-ink-2 hover:text-ink"
              >
                + {idea}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-md border-2 border-risk bg-risk-soft px-3 py-2 text-sm font-semibold text-risk">
            {error}
          </p>
        )}

        <button className="btn-brand w-full text-base" disabled={busy}>
          {busy ? "Creating…" : `Start ${TRIAL_DAYS}-day free trial →`}
        </button>
        <p className="text-center text-xs font-medium text-ink-2">
          No card required. Cancel any time from Settings.
        </p>
      </form>

      {/* Live preview — you see the card your customers will see, as you type. */}
      <aside className="mt-10 lg:sticky lg:top-8 lg:mt-0">
        <div className="label mb-3">What customers will see</div>
        <StampCardView
          restaurant={{
            name: form.name || "Your business",
            stamps_required: Math.max(1, Math.min(30, form.stamps_required || 1)),
            reward_title: form.reward_title || "Free reward",
            logo_url: null,
          }}
          current={Math.min(3, Math.max(1, form.stamps_required || 1))}
        />
        <p className="mt-4 text-xs font-medium text-ink-2">Preview only — no stamps have been issued.</p>
      </aside>
    </div>
  );
}
