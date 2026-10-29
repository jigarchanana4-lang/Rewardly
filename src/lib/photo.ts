/**
 * Yummy CAM — photographic enhancement for food photos.
 *
 * Deliberately NOT image generation. A generated burger that doesn't match what
 * arrives at the table is a consumer complaint and a Swiggy/Zomato policy
 * problem for the restaurant. Everything here is a correction applied to the
 * real pixels: exposure, white balance, contrast, saturation, sharpening.
 *
 * Bad restaurant photos are overwhelmingly badly LIT and badly WHITE-BALANCED,
 * not badly composed — which is why these particular controls, in this order,
 * do most of the work.
 *
 * Pure functions over RGBA byte arrays so they're testable without a browser.
 */

export interface Adjustments {
  /** −1..1 — stops of exposure, roughly. */
  exposure: number;
  /** −1..1 */
  contrast: number;
  /** −1..1 — pushes colour without wrecking already-saturated food. */
  vibrance: number;
  /** −1..1 — negative cools (kills canteen-yellow light), positive warms. */
  warmth: number;
  /** 0..1 */
  sharpen: number;
}

export const NEUTRAL: Adjustments = {
  exposure: 0,
  contrast: 0,
  vibrance: 0,
  warmth: 0,
  sharpen: 0,
};

export interface Preset {
  id: string;
  name: string;
  hint: string;
  adjustments: Adjustments;
}

/** Tuned for the three ways Indian restaurant photos usually go wrong. */
export const PRESETS: Preset[] = [
  {
    id: "fresh",
    name: "Fresh",
    hint: "Brighter and cleaner. Start here.",
    adjustments: { exposure: 0.18, contrast: 0.14, vibrance: 0.22, warmth: 0.04, sharpen: 0.35 },
  },
  {
    id: "warm",
    name: "Warm",
    hint: "For curries, tandoor, anything rich.",
    adjustments: { exposure: 0.12, contrast: 0.2, vibrance: 0.3, warmth: 0.18, sharpen: 0.3 },
  },
  {
    id: "daylight",
    name: "Daylight",
    hint: "Cools down yellow indoor lighting.",
    adjustments: { exposure: 0.22, contrast: 0.1, vibrance: 0.16, warmth: -0.16, sharpen: 0.28 },
  },
  {
    id: "punch",
    name: "Punch",
    hint: "High contrast for delivery-app thumbnails.",
    adjustments: { exposure: 0.1, contrast: 0.34, vibrance: 0.36, warmth: 0.06, sharpen: 0.5 },
  },
  {
    id: "none",
    name: "Original",
    hint: "No changes.",
    adjustments: NEUTRAL,
  },
];

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Apply tone and colour adjustments in place.
 * Order matters: exposure before contrast (so contrast pivots around a
 * correctly-exposed midpoint), colour last.
 */
export function applyAdjustments(data: Uint8ClampedArray, a: Adjustments): Uint8ClampedArray {
  const exposure = 1 + a.exposure;
  // Standard contrast factor, pivoting on mid-grey.
  const c = a.contrast * 255;
  const contrast = (259 * (c + 255)) / (255 * (259 - c));
  const warmR = 1 + a.warmth * 0.18;
  const warmB = 1 - a.warmth * 0.18;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * exposure * warmR;
    let g = data[i + 1] * exposure;
    let b = data[i + 2] * exposure * warmB;

    r = contrast * (r - 128) + 128;
    g = contrast * (g - 128) + 128;
    b = contrast * (b - 128) + 128;

    if (a.vibrance !== 0) {
      // Vibrance, not saturation: scale by how UNsaturated the pixel already is,
      // so a red curry doesn't blow out to a flat blob while dull rice lifts.
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = (max - min) / 255;
      let amt = a.vibrance * (1 - sat);
      // Second guard: don't push a pixel that is already near the ceiling into
      // clipping. Without this, a bright red curry loses all detail in the
      // reds — the single most common way "enhanced" food photos look worse
      // than the original.
      if (amt > 0 && max > 200) amt *= Math.max(0, (255 - max) / 55);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r += (r - lum) * amt;
      g += (g - lum) * amt;
      b += (b - lum) * amt;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
  return data;
}

/**
 * Unsharp-style sharpening via a 3x3 convolution.
 * Reads from a copy so neighbouring reads aren't polluted by earlier writes —
 * doing it in place produces a smeared, directional artefact.
 */
export function sharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  if (amount <= 0) return data;
  const src = new Uint8ClampedArray(data);
  const k = amount;
  const centre = 1 + 4 * k;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const p = i + ch;
        const v =
          src[p] * centre -
          k * src[p - 4] -
          k * src[p + 4] -
          k * src[p - width * 4] -
          k * src[p + width * 4];
        data[p] = clamp255(v);
      }
    }
  }
  return data;
}

/** Output sizes people actually need. */
export interface ExportSize {
  id: string;
  name: string;
  hint: string;
  ratio: number | null;
  maxEdge: number;
}

export const EXPORT_SIZES: ExportSize[] = [
  { id: "original", name: "Original", hint: "Same shape, cleaned up", ratio: null, maxEdge: 2000 },
  { id: "square", name: "Square", hint: "Swiggy, Zomato, menus", ratio: 1, maxEdge: 1400 },
  { id: "portrait", name: "Portrait", hint: "Stories, Reels", ratio: 4 / 5, maxEdge: 1600 },
];

/** Centre-crop box for a target aspect ratio. */
export function cropBox(w: number, h: number, ratio: number | null) {
  if (!ratio) return { x: 0, y: 0, w, h };
  const current = w / h;
  if (current > ratio) {
    const nw = Math.round(h * ratio);
    return { x: Math.round((w - nw) / 2), y: 0, w: nw, h };
  }
  const nh = Math.round(w / ratio);
  return { x: 0, y: Math.round((h - nh) / 2), w, h: nh };
}
