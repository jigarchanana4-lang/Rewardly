/**
 * Per-shop theming.
 *
 * The design tokens in globals.css hold raw RGB channels ("75 33 245") so that
 * Tailwind opacity modifiers work. A shop theme therefore has to emit channels
 * too — not hex — which is what everything below is for.
 *
 * Text colours are never taken from the owner: they're derived from the chosen
 * background by contrast, so a pale brand colour can't produce an unreadable
 * card. That's the whole reason this file exists rather than an inline style.
 */

export type Rgb = [number, number, number];

/** Rewardly's own ink / paper, used as mixing targets and text fallbacks. */
const INK: Rgb = [20, 9, 59];
const WHITE: Rgb = [255, 255, 255];
/** The dark-theme surface tints are mixed toward, so soft fills stay dark. */
const DARK_SURFACE: Rgb = [23, 16, 61];

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function channels([r, g, b]: Rgb): string {
  return `${r} ${g} ${b}`;
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick whichever of white / ink reads better on the given background. */
export function readableOn(bg: Rgb): Rgb {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, INK) ? WHITE : INK;
}

/** Blend `from` toward `to` by `amount` (0–1). */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((c, i) => Math.round(c + (to[i] - c) * amount)) as Rgb;
}

/** Nudge a colour darker (light theme) for hover/pressed brand states. */
function shade(c: Rgb, amount: number): Rgb {
  return mix(c, [0, 0, 0], amount);
}

export interface ShopTheme {
  brand: string;
  accent: string;
}

/**
 * Build the scoped CSS that re-tints the design tokens for one shop.
 * Returns "" when the shop hasn't chosen colours, so the default palette wins
 * and no extra style element is emitted.
 */
export function shopThemeCss(scope: string, theme: Partial<ShopTheme>): string {
  const brand = theme.brand ? hexToRgb(theme.brand) : null;
  const accent = theme.accent ? hexToRgb(theme.accent) : null;
  if (!brand && !accent) return "";

  const light: string[] = [];
  const dark: string[] = [];

  if (brand) {
    light.push(`--brand:${channels(brand)}`);
    light.push(`--on-brand:${channels(readableOn(brand))}`);
    light.push(`--brand-ink:${channels(shade(brand, 0.22))}`);
    light.push(`--brand-soft:${channels(mix(brand, WHITE, 0.86))}`);
    // On dark grounds, lift the hue toward white so it stays visible, and mix
    // the soft fill toward the dark surface instead of white.
    const darkBrand = luminance(brand) < 0.22 ? mix(brand, WHITE, 0.45) : brand;
    dark.push(`--brand:${channels(darkBrand)}`);
    dark.push(`--on-brand:${channels(readableOn(darkBrand))}`);
    dark.push(`--brand-ink:${channels(mix(darkBrand, WHITE, 0.2))}`);
    dark.push(`--brand-soft:${channels(mix(brand, DARK_SURFACE, 0.72))}`);
  }

  if (accent) {
    light.push(`--accent:${channels(accent)}`);
    light.push(`--accent-ink:${channels(readableOn(accent))}`);
    light.push(`--accent-soft:${channels(mix(accent, WHITE, 0.82))}`);
    dark.push(`--accent:${channels(accent)}`);
    dark.push(`--accent-ink:${channels(readableOn(accent))}`);
    dark.push(`--accent-soft:${channels(mix(accent, DARK_SURFACE, 0.75))}`);
  }

  return (
    `[data-shop-theme="${scope}"]{${light.join(";")}}` +
    `@media (prefers-color-scheme:dark){` +
    `[data-shop-theme="${scope}"]:not([data-theme="light"] *){${dark.join(";")}}}` +
    `[data-theme="dark"] [data-shop-theme="${scope}"]{${dark.join(";")}}`
  );
}
