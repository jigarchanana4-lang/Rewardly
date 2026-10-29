"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PALETTES } from "@/config/palettes";
import { BRAND } from "@/config/brand";
import { hexToRgb, readableOn, channels } from "@/lib/theme";
import ShopTheme from "@/components/ShopTheme";

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Tier A branding: the shop's own colours on its public page and loyalty card.
 *
 * Presets are the safe path; custom hex is allowed but text colour is always
 * derived by contrast, so an owner can't produce an unreadable card.
 */
export default function BrandThemePicker({
  restaurantId,
  initialBrand,
  initialAccent,
  initialWhiteLabel,
  canWhiteLabel,
}: {
  restaurantId: string;
  initialBrand: string | null;
  initialAccent: string | null;
  initialWhiteLabel: boolean;
  canWhiteLabel: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [accent, setAccent] = useState(initialAccent ?? "");
  const [whiteLabel, setWhiteLabel] = useState(initialWhiteLabel);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandValid = !brand || HEX.test(brand);
  const accentValid = !accent || HEX.test(accent);
  const usingDefault = !brand && !accent;

  function choose(b: string, a: string) {
    setBrand(b);
    setAccent(a);
    setSaved(false);
  }

  async function save() {
    if (!brandValid || !accentValid) return setError("Colours must be 6-digit hex, e.g. #4B21F5");
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("restaurants")
      .update({
        brand_color: brand || null,
        accent_color: accent || null,
        white_label: canWhiteLabel ? whiteLabel : false,
      })
      .eq("id", restaurantId);
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="display text-lg">Your brand</div>
          <p className="mt-0.5 text-sm font-medium text-ink-2">
            Customers see these colours on your page and their card.
          </p>
        </div>
        {!usingDefault && (
          <button
            type="button"
            className="btn-flat shrink-0 text-xs"
            onClick={() => choose("", "")}
          >
            Reset
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5">
        {PALETTES.map((p) => {
          const active = brand.toLowerCase() === p.brand.toLowerCase();
          return (
            <button
              key={p.id}
              type="button"
              title={p.name}
              aria-label={p.name}
              aria-pressed={active}
              onClick={() => choose(p.brand, p.accent)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition ${
                active ? "border-edge shadow-pop" : "border-line hover:border-edge"
              }`}
              style={{ background: p.brand }}
            >
              <span className="absolute bottom-0 right-0 h-1/2 w-1/2" style={{ background: p.accent }} />
            </button>
          );
        })}
      </div>

      {/* Custom hex */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="brand-hex">
            Main colour
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick main colour"
              value={HEX.test(brand) ? brand : BRAND.colors.brand}
              onChange={(e) => choose(e.target.value, accent || BRAND.colors.accent)}
              className="h-11 w-11 shrink-0 cursor-pointer rounded-md border-2 border-line bg-surface p-1"
            />
            <input
              id="brand-hex"
              className="field font-mono uppercase"
              placeholder={BRAND.colors.brand}
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          {!brandValid && <p className="mt-1 text-xs font-semibold text-risk">Use #RRGGBB</p>}
        </div>

        <div>
          <label className="label" htmlFor="accent-hex">
            Highlight colour
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick highlight colour"
              value={HEX.test(accent) ? accent : BRAND.colors.accent}
              onChange={(e) => choose(brand || BRAND.colors.brand, e.target.value)}
              className="h-11 w-11 shrink-0 cursor-pointer rounded-md border-2 border-line bg-surface p-1"
            />
            <input
              id="accent-hex"
              className="field font-mono uppercase"
              placeholder={BRAND.colors.accent}
              value={accent}
              onChange={(e) => {
                setAccent(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          {!accentValid && <p className="mt-1 text-xs font-semibold text-risk">Use #RRGGBB</p>}
        </div>
      </div>

      <Preview brand={brand} accent={accent} />

      {/* White-label */}
      <div
        className={`mt-4 rounded-md border-2 px-4 py-3 ${
          canWhiteLabel ? "border-line bg-surface-2" : "border-dashed border-line"
        }`}
      >
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
            checked={canWhiteLabel && whiteLabel}
            disabled={!canWhiteLabel}
            onChange={(e) => {
              setWhiteLabel(e.target.checked);
              setSaved(false);
            }}
          />
          <span>
            <span className="flex items-center gap-2 font-bold">
              Hide {BRAND.name} branding
              {!canWhiteLabel && <span className="chip-soft">Pro</span>}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-ink-2">
              Your page shows only your brand. Customers still keep one {BRAND.name} account across
              every shop.
            </span>
          </span>
        </label>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-risk">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button className="btn-brand" onClick={save} disabled={busy || !brandValid || !accentValid}>
          {busy ? "Saving…" : "Save branding"}
        </button>
        {saved && <span className="chip border-edge bg-good text-white">Saved ✓</span>}
      </div>
    </div>
  );
}

/** Live sample of the card a customer will hold, in the chosen colours. */
function Preview({ brand, accent }: { brand: string; accent: string }) {
  const b = HEX.test(brand) ? brand : BRAND.colors.brand;
  const a = HEX.test(accent) ? accent : BRAND.colors.accent;
  const onBrand = hexToRgb(b) ? `rgb(${channels(readableOn(hexToRgb(b)!))})` : "#fff";

  return (
    <div className="mt-5">
      <div className="label mb-2">Preview</div>
      <ShopTheme id="preview" brand={b} accent={a}>
        <div className="overflow-hidden rounded-lg border-2 border-edge shadow-pop">
          <div className="px-4 py-4" style={{ background: b, color: onBrand }}>
            <div className="text-xs font-bold opacity-80">Your café</div>
            <div className="mt-1 flex items-end gap-1.5">
              <span className="display text-4xl leading-none">7</span>
              <span className="mb-0.5 text-sm font-bold opacity-70">/ 10</span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-pill" style={{ background: "rgba(255,255,255,.25)" }}>
              <div className="h-full w-[70%] rounded-pill" style={{ background: a }} />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface px-4 py-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="h-4 w-4 shrink-0 rounded-full border-2"
                style={
                  i < 7
                    ? { background: b, borderColor: "rgb(var(--edge))" }
                    : { borderStyle: "dashed", borderColor: "rgb(var(--line))" }
                }
              />
            ))}
          </div>
        </div>
      </ShopTheme>
    </div>
  );
}
