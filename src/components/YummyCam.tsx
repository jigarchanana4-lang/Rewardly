"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_OPS } from "@/lib/imageGen";
import {
  applyAdjustments,
  sharpen,
  cropBox,
  PRESETS,
  EXPORT_SIZES,
  NEUTRAL,
  type Adjustments,
} from "@/lib/photo";

interface Advice {
  verdict: string;
  fixes: string[];
  reshoot: string[];
  suggested: Adjustments;
  simulated?: boolean;
}

const MAX_WORKING_EDGE = 1600;

/**
 * Yummy CAM. Corrections are applied to the customer's real photo in the
 * browser — nothing is uploaded to render, nothing is generated. The only thing
 * that leaves the device is a downscaled copy sent for written advice, and only
 * when the owner asks for it.
 */
export default function YummyCam({
  restaurantId,
  credits: initialCredits,
}: {
  restaurantId: string;
  credits: number;
}) {
  const [src, setSrc] = useState<HTMLImageElement | null>(null);
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [running, setRunning] = useState<string | null>(null);
  const [adj, setAdj] = useState<Adjustments>(PRESETS[0].adjustments);
  const [preset, setPreset] = useState("fresh");
  const [size, setSize] = useState("original");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Render at working resolution for a responsive preview. */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const scale = Math.min(1, MAX_WORKING_EDGE / Math.max(src.width, src.height));
    const w = Math.round(src.width * scale);
    const h = Math.round(src.height * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(src, 0, 0, w, h);
    if (compare) return; // show the untouched original
    const img = ctx.getImageData(0, 0, w, h);
    applyAdjustments(img.data, adj);
    sharpen(img.data, w, h, adj.sharpen);
    ctx.putImageData(img, 0, 0);
  }, [src, adj, compare]);

  useEffect(() => {
    render();
  }, [render]);

  function load(file: File) {
    setError(null);
    setAdvice(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setSrc(img);
        setOriginal(img);
      };
      img.onerror = () => setError("That file isn't a readable image.");
      img.src = reader.result as string;
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function choosePreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setAdj(p.adjustments);
  }

  function set<K extends keyof Adjustments>(k: K, v: number) {
    setPreset("custom");
    setAdj((a) => ({ ...a, [k]: v }));
  }

  /** Downscale hard before sending — advice doesn't need full resolution. */
  async function askAdvice() {
    if (!src) return;
    setBusy(true);
    setError(null);
    try {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1000 / Math.max(src.width, src.height));
      c.width = Math.round(src.width * scale);
      c.height = Math.round(src.height * scale);
      c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
      const b64 = c.toDataURL("image/jpeg", 0.82).split(",")[1];

      const res = await fetch("/api/photo/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not review that photo.");
      setAdvice(json as Advice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Model-powered upgrade. Charged in credits server-side; the result becomes
   * the working image so local sliders still apply on top of it, and the
   * untouched original stays available to revert to.
   */
  async function runUpgrade(opId: string) {
    if (!src) return;
    const op = IMAGE_OPS[opId];
    if (!op) return;
    setRunning(opId);
    setError(null);
    try {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(src.width, src.height));
      c.width = Math.round(src.width * scale);
      c.height = Math.round(src.height * scale);
      c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
      const b64 = c.toDataURL("image/jpeg", 0.9).split(",")[1];

      const res = await fetch("/api/photo/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          operation: opId,
          image: b64,
          // Stable per attempt, so a retry of this same click is not charged twice.
          requestId: `${restaurantId}:${opId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (typeof json.refunded === "number") setCredits((c) => c + json.refunded);
        throw new Error(json.error ?? "Could not process that photo.");
      }

      const img = new Image();
      img.onload = () => setSrc(img);
      img.src = `data:${json.mediaType};base64,${json.image}`;
      if (typeof json.creditsLeft === "number") setCredits(json.creditsLeft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(null);
    }
  }

  /** Export from the ORIGINAL pixels, not the downscaled preview. */
  function download() {
    if (!src) return;
    const spec = EXPORT_SIZES.find((s) => s.id === size) ?? EXPORT_SIZES[0];
    const box = cropBox(src.width, src.height, spec.ratio);
    const scale = Math.min(1, spec.maxEdge / Math.max(box.w, box.h));
    const w = Math.round(box.w * scale);
    const h = Math.round(box.h * scale);

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    applyAdjustments(img.data, adj);
    sharpen(img.data, w, h, adj.sharpen);
    ctx.putImageData(img, 0, 0);

    const a = document.createElement("a");
    a.href = c.toDataURL("image/jpeg", 0.92);
    a.download = `dish-${spec.id}.jpg`;
    a.click();
  }

  if (!src) {
    return (
      <div className="card-pop mt-6 text-center">
        <div className="eyebrow text-brand">Step 1</div>
        <div className="display mt-1 text-xl">Add a photo of a dish</div>
        <p className="mx-auto mt-1.5 max-w-sm text-sm font-medium text-ink-2">
          Straight from your phone is fine. We fix the lighting and colour — we never change the
          food, so what customers see is what arrives.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
        />
        <button className="btn-brand mt-5" onClick={() => fileRef.current?.click()}>
          Choose a photo
        </button>
        {error && <p className="mt-3 text-sm font-semibold text-risk">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-6">
      <div>
        <div className="overflow-hidden rounded-lg border-2 border-edge shadow-pop">
          <canvas ref={canvasRef} className="block h-auto w-full bg-surface-2" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn-flat"
            onMouseDown={() => setCompare(true)}
            onMouseUp={() => setCompare(false)}
            onMouseLeave={() => setCompare(false)}
            onTouchStart={() => setCompare(true)}
            onTouchEnd={() => setCompare(false)}
          >
            {compare ? "Showing original" : "Hold to compare"}
          </button>
          <button className="btn-flat" onClick={() => fileRef.current?.click()}>
            Change photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          />
        </div>
      </div>

      <div className="mt-6 space-y-5 lg:mt-0">
        <div>
          <div className="label mb-2">Look</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                title={p.hint}
                onClick={() => choosePreset(p.id)}
                className={`chip ${
                  preset === p.id ? "border-edge bg-brand text-on-brand" : "border-line bg-surface text-ink-2"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Slider label="Brightness" v={adj.exposure} onChange={(v) => set("exposure", v)} />
          <Slider label="Contrast" v={adj.contrast} onChange={(v) => set("contrast", v)} />
          <Slider label="Colour" v={adj.vibrance} onChange={(v) => set("vibrance", v)} />
          <Slider label="Warmth" v={adj.warmth} onChange={(v) => set("warmth", v)} />
          <Slider label="Sharpness" v={adj.sharpen} min={0} onChange={(v) => set("sharpen", v)} />
          <button className="btn-flat w-full" onClick={() => { setAdj(NEUTRAL); setPreset("none"); }}>
            Reset
          </button>
        </div>

        <div>
          <div className="label mb-2">Save for</div>
          <div className="flex flex-wrap gap-2">
            {EXPORT_SIZES.map((s) => (
              <button
                key={s.id}
                title={s.hint}
                onClick={() => setSize(s.id)}
                className={`chip ${
                  size === s.id ? "border-edge bg-accent text-accent-ink" : "border-line bg-surface text-ink-2"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn-brand mt-3 w-full" onClick={download}>
            Download photo
          </button>
        </div>

        <div className="rounded-lg border-2 border-edge bg-surface p-4 shadow-pop">
          <div className="flex items-center justify-between gap-2">
            <div className="display text-lg">AI upgrades</div>
            <span className="chip-soft font-mono tabular-nums">{credits} left</span>
          </div>
          <p className="mt-1 text-sm font-medium text-ink-2">
            These use credits. The sliders above are always free.
          </p>
          <div className="mt-3 space-y-2">
            {Object.values(IMAGE_OPS).map((op) => (
              <button
                key={op.id}
                onClick={() => runUpgrade(op.id)}
                disabled={running !== null || credits < op.cost}
                className="flex w-full items-center justify-between gap-3 rounded-md border-2 border-line bg-surface px-3 py-2.5 text-left transition hover:border-edge disabled:opacity-45"
              >
                <span className="min-w-0">
                  <span className="block font-bold">{op.name}</span>
                  <span className="block text-xs font-medium text-ink-2">{op.hint}</span>
                </span>
                <span className="chip-accent shrink-0 font-mono">
                  {running === op.id ? "…" : `${op.cost}`}
                </span>
              </button>
            ))}
          </div>
          {credits < 1 && (
            <a href="/owner/billing#credits" className="btn-brand mt-3 w-full">
              Top up credits
            </a>
          )}
          {original && src !== original && (
            <button className="btn-flat mt-2 w-full" onClick={() => setSrc(original)}>
              Revert to my original photo
            </button>
          )}
        </div>

        <div className="rounded-lg border-2 border-line bg-surface p-4">
          <div className="display text-lg">What would make this better?</div>
          <p className="mt-1 text-sm font-medium text-ink-2">
            Get a photographer&rsquo;s read on this shot and how to take the next one.
          </p>
          <button className="btn-ghost mt-3 w-full" onClick={askAdvice} disabled={busy}>
            {busy ? "Looking…" : "Review my photo"}
          </button>

          {advice && (
            <div className="mt-4 space-y-3">
              {advice.simulated && (
                <p className="rounded-md border-2 border-dashed border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-2">
                  Sample feedback — no AI key is configured on this server yet.
                </p>
              )}
              <p className="font-bold">{advice.verdict}</p>
              {advice.fixes?.length > 0 && (
                <div>
                  <div className="label">Fix now</div>
                  <ul className="mt-1 space-y-1 text-sm font-medium">
                    {advice.fixes.map((f, i) => <li key={i}>· {f}</li>)}
                  </ul>
                </div>
              )}
              {advice.reshoot?.length > 0 && (
                <div>
                  <div className="label">Next time</div>
                  <ul className="mt-1 space-y-1 text-sm font-medium text-ink-2">
                    {advice.reshoot.map((f, i) => <li key={i}>· {f}</li>)}
                  </ul>
                </div>
              )}
              {advice.suggested && (
                <button
                  className="btn-accent w-full"
                  onClick={() => { setAdj(advice.suggested); setPreset("custom"); }}
                >
                  Apply these settings
                </button>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm font-semibold text-risk">{error}</p>}
      </div>
    </div>
  );
}

function Slider({
  label, v, onChange, min = -1,
}: { label: string; v: number; onChange: (v: number) => void; min?: number }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="font-mono text-xs tabular-nums text-ink-2">{v.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={1}
        step={0.01}
        value={v}
        onChange={(e) => onChange(globalThis.Number(e.target.value))}
        className="mt-1 w-full accent-brand"
      />
    </label>
  );
}
