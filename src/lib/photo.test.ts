import { describe, it, expect } from "vitest";
import { applyAdjustments, sharpen, cropBox, NEUTRAL, PRESETS } from "./photo";

const px = (vals: number[]) => new Uint8ClampedArray(vals);
/** Solid mid-grey image, w*h pixels. */
const grey = (w: number, h: number, v = 128) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return d;
};

describe("applyAdjustments", () => {
  it("is a no-op at neutral", () => {
    const before = px([100, 120, 140, 255]);
    const after = applyAdjustments(px([100, 120, 140, 255]), NEUTRAL);
    expect(Array.from(after)).toEqual(Array.from(before));
  });

  it("brightens with positive exposure and darkens with negative", () => {
    const up = applyAdjustments(px([100, 100, 100, 255]), { ...NEUTRAL, exposure: 0.5 });
    const down = applyAdjustments(px([100, 100, 100, 255]), { ...NEUTRAL, exposure: -0.5 });
    expect(up[0]).toBeGreaterThan(100);
    expect(down[0]).toBeLessThan(100);
  });

  it("never leaves the 0–255 range, even at extremes", () => {
    const hot = applyAdjustments(px([250, 250, 250, 255]), {
      exposure: 1, contrast: 1, vibrance: 1, warmth: 1, sharpen: 0,
    });
    const cold = applyAdjustments(px([5, 5, 5, 255]), {
      exposure: -1, contrast: 1, vibrance: 1, warmth: -1, sharpen: 0,
    });
    for (const v of [...hot.slice(0, 3), ...cold.slice(0, 3)]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it("never touches alpha — a transparent PNG must stay transparent", () => {
    const out = applyAdjustments(px([100, 100, 100, 0]), { ...NEUTRAL, exposure: 0.8 });
    expect(out[3]).toBe(0);
  });

  it("warmth pushes red up and blue down, and cooling reverses it", () => {
    const warm = applyAdjustments(px([128, 128, 128, 255]), { ...NEUTRAL, warmth: 0.5 });
    expect(warm[0]).toBeGreaterThan(warm[2]);
    const cool = applyAdjustments(px([128, 128, 128, 255]), { ...NEUTRAL, warmth: -0.5 });
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });

  it("vibrance lifts dull colours proportionally more than saturated ones", () => {
    // The point of vibrance over saturation. Measured as saturation GAIN, not
    // raw channel shift — a vivid pixel sits far from its luminance, so it
    // moves further in absolute terms even under a much smaller multiplier.
    const sat = (p: Uint8ClampedArray) =>
      (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])) / 255;

    const dullBefore = px([130, 128, 126, 255]);
    const vividBefore = px([240, 20, 20, 255]);
    const dullAfter = applyAdjustments(px([130, 128, 126, 255]), { ...NEUTRAL, vibrance: 0.8 });
    const vividAfter = applyAdjustments(px([240, 20, 20, 255]), { ...NEUTRAL, vibrance: 0.8 });

    const dullGain = sat(dullAfter) / sat(dullBefore);
    const vividGain = sat(vividAfter) / sat(vividBefore);
    expect(dullGain).toBeGreaterThan(vividGain);
  });

  it("does not clip already-bright saturated colours", () => {
    // Regression: blown-out red curry. A bright saturated pixel must keep
    // headroom rather than being pushed to 255 and losing all detail.
    const out = applyAdjustments(px([240, 20, 20, 255]), { ...NEUTRAL, vibrance: 1 });
    expect(out[0]).toBeLessThan(255);
  });

  it("leaves a flat grey field flat (no colour cast introduced)", () => {
    const out = applyAdjustments(px([128, 128, 128, 255]), { ...NEUTRAL, exposure: 0.3, contrast: 0.3 });
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });
});

describe("sharpen", () => {
  it("does nothing at zero", () => {
    const before = grey(5, 5);
    const after = sharpen(grey(5, 5), 5, 5, 0);
    expect(Array.from(after)).toEqual(Array.from(before));
  });

  it("leaves a flat image flat — sharpening noise is the classic artefact", () => {
    const out = sharpen(grey(5, 5, 128), 5, 5, 0.5);
    // interior pixels only; edges are untouched by design
    const centre = (2 * 5 + 2) * 4;
    expect(out[centre]).toBe(128);
  });

  it("increases local contrast at an edge", () => {
    const w = 5, h = 3;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const v = x < 2 ? 80 : 180;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
    const out = sharpen(d, w, h, 0.6);
    const dark = out[(1 * w + 1) * 4];
    const light = out[(1 * w + 3) * 4];
    expect(light - dark).toBeGreaterThan(100);
  });
});

describe("cropBox", () => {
  it("returns the full frame when no ratio is requested", () => {
    expect(cropBox(800, 600, null)).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("centre-crops a landscape photo to a square", () => {
    const b = cropBox(800, 600, 1);
    expect(b).toEqual({ x: 100, y: 0, w: 600, h: 600 });
  });

  it("centre-crops a portrait photo to a square", () => {
    const b = cropBox(600, 800, 1);
    expect(b).toEqual({ x: 0, y: 100, w: 600, h: 600 });
  });

  it("never crops outside the source image", () => {
    for (const [w, h] of [[800, 600], [600, 800], [1000, 1000], [1920, 1080]]) {
      for (const r of [1, 4 / 5, 16 / 9]) {
        const b = cropBox(w, h, r);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(w);
        expect(b.y + b.h).toBeLessThanOrEqual(h);
      }
    }
  });
});

describe("presets", () => {
  it("all stay inside the documented control ranges", () => {
    for (const p of PRESETS) {
      const a = p.adjustments;
      for (const k of ["exposure", "contrast", "vibrance", "warmth"] as const) {
        expect(Math.abs(a[k])).toBeLessThanOrEqual(1);
      }
      expect(a.sharpen).toBeGreaterThanOrEqual(0);
      expect(a.sharpen).toBeLessThanOrEqual(1);
    }
  });

  it("includes an untouched original", () => {
    expect(PRESETS.find((p) => p.id === "none")?.adjustments).toEqual(NEUTRAL);
  });
});
