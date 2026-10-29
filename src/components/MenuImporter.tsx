"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MenuCategory } from "@/lib/types";

interface Draft {
  category: string;
  name: string;
  description: string | null;
  price: number | null;
  include: boolean;
}

const MAX_IMAGES = 6;
/** Phone photos are 4–8MB; downscale in the browser so uploads stay fast. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** Resize + re-encode a photo, returning raw base64 (no data: prefix). */
function prepare(file: File): Promise<{ data: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not process that image."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve({ data: url.split(",")[1] ?? "", preview: url });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Photograph a paper menu, let the model read it, then review before saving.
 *
 * The review step is deliberate: OCR on a real menu will get something wrong,
 * and silently writing a wrong price into a live catalogue is worse than
 * asking for ten seconds of checking.
 */
export default function MenuImporter({
  restaurantId,
  existingCategories,
}: {
  restaurantId: string;
  existingCategories: MenuCategory[];
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<{ data: string; preview: string }[]>([]);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [busy, setBusy] = useState<null | "reading" | "saving">(null);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_IMAGES - shots.length;
    if (room <= 0) return setError(`Up to ${MAX_IMAGES} photos at a time.`);
    try {
      const prepared = await Promise.all(Array.from(files).slice(0, room).map(prepare));
      setShots((s) => [...s, ...prepared]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read those photos.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function read() {
    setBusy("reading");
    setError(null);
    try {
      const res = await fetch("/api/menu/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          images: shots.map((s) => ({ media_type: "image/jpeg", data: s.data })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not read that menu.");
      if (!json.items?.length) throw new Error("No items found. Try a clearer, straight-on photo.");
      setSimulated(!!json.simulated);
      setDrafts(
        (json.items as Omit<Draft, "include">[]).map((i) => ({ ...i, include: true })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!drafts) return;
    const chosen = drafts.filter((d) => d.include && d.name.trim());
    if (!chosen.length) return setError("Pick at least one item.");

    setBusy("saving");
    setError(null);
    try {
      // Reuse categories that already exist; create only what's genuinely new.
      const byName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));
      const needed = [...new Set(chosen.map((c) => c.category))].filter(
        (n) => !byName.has(n.toLowerCase()),
      );

      if (needed.length) {
        const { data: created, error: catErr } = await supabase
          .from("menu_categories")
          .insert(
            needed.map((name, i) => ({
              restaurant_id: restaurantId,
              name,
              sort_order: existingCategories.length + i,
            })),
          )
          .select("id, name");
        if (catErr) throw new Error(catErr.message);
        for (const c of created ?? []) byName.set(c.name.toLowerCase(), c.id);
      }

      const { error: itemErr } = await supabase.from("menu_items").insert(
        chosen.map((d, i) => ({
          restaurant_id: restaurantId,
          category_id: byName.get(d.category.toLowerCase()) ?? null,
          name: d.name.trim(),
          description: d.description,
          price: d.price,
          is_available: true,
          sort_order: i,
        })),
      );
      if (itemErr) throw new Error(itemErr.message);

      // Full reload so the manager below re-reads the saved catalogue.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save those items.");
      setBusy(null);
    }
  }

  const patch = (i: number, p: Partial<Draft>) =>
    setDrafts((d) => d && d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const chosenCount = drafts?.filter((d) => d.include).length ?? 0;

  /* ---------- Review ---------- */
  if (drafts) {
    return (
      <div className="card-pop">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="display text-lg">Check before adding</div>
            <p className="mt-0.5 text-sm font-medium text-ink-2">
              Fix anything that reads wrong — prices especially.
            </p>
          </div>
          <span className="chip-accent shrink-0 font-mono tabular-nums">{chosenCount}</span>
        </div>

        {simulated && (
          <p className="mt-3 rounded-md border-2 border-dashed border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-2">
            Sample data — no scanning key is configured on this server yet.
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {drafts.map((d, i) => (
            <li
              key={i}
              className={`rounded-md border-2 p-3 transition ${
                d.include ? "border-line bg-surface" : "border-dashed border-line opacity-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`Include ${d.name}`}
                  className="h-4 w-4 shrink-0 accent-brand"
                  checked={d.include}
                  onChange={(e) => patch(i, { include: e.target.checked })}
                />
                <input
                  className="field flex-1 py-2"
                  value={d.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
                <div className="flex w-24 shrink-0 items-center gap-1 rounded-md border-2 border-line bg-surface px-2">
                  <span className="text-sm font-bold text-ink-2">₹</span>
                  <input
                    inputMode="numeric"
                    className="w-full bg-transparent py-2 font-mono text-sm outline-none"
                    placeholder="—"
                    value={d.price ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      patch(i, { price: v ? globalThis.Number(v) : null });
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-7">
                <span className="label shrink-0">In</span>
                <input
                  className="w-full rounded-sm border-2 border-line bg-surface-2 px-2 py-1 text-xs font-bold outline-none focus:border-brand"
                  value={d.category}
                  onChange={(e) => patch(i, { category: e.target.value })}
                />
              </div>
            </li>
          ))}
        </ul>

        {error && <p className="mt-3 text-sm font-semibold text-risk">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button className="btn-brand flex-1" onClick={save} disabled={busy === "saving"}>
            {busy === "saving" ? "Adding…" : `Add ${chosenCount} item${chosenCount === 1 ? "" : "s"}`}
          </button>
          <button
            className="btn-flat"
            onClick={() => {
              setDrafts(null);
              setShots([]);
            }}
            disabled={busy === "saving"}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Upload ---------- */
  return (
    <div className="card-pop">
      <div className="eyebrow text-brand">Fastest way</div>
      <div className="display mt-1 text-lg">Photograph your menu</div>
      <p className="mt-0.5 text-sm font-medium text-ink-2">
        Snap your printed menu and we&rsquo;ll type it up for you. You review everything before it goes live.
      </p>

      {shots.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shots.map((s, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.preview}
                alt={`Menu photo ${i + 1}`}
                className="h-24 w-20 rounded-md border-2 border-edge object-cover"
              />
              <button
                aria-label="Remove photo"
                onClick={() => setShots((x) => x.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-edge bg-surface text-xs font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {error && <p className="mt-3 text-sm font-semibold text-risk">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={shots.length >= MAX_IMAGES}
        >
          {shots.length ? "Add another photo" : "Choose photos"}
        </button>
        {shots.length > 0 && (
          <button className="btn-brand flex-1" onClick={read} disabled={busy === "reading"}>
            {busy === "reading" ? "Reading your menu…" : `Read ${shots.length} photo${shots.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-2">
        Straight-on, well-lit shots read best. Up to {MAX_IMAGES} photos at a time.
      </p>
    </div>
  );
}
