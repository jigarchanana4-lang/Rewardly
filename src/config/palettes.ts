/**
 * Curated brand palettes offered in Settings.
 *
 * Every pair here has been picked so the accent stays legible beside the brand
 * and both survive the light and dark grounds. Owners can still enter custom
 * hex, but the presets are the path that can't produce an ugly card.
 */
export interface Palette {
  id: string;
  name: string;
  brand: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { id: "ultraviolet", name: "Ultraviolet", brand: "#4B21F5", accent: "#D9FF3D" },
  { id: "espresso", name: "Espresso", brand: "#4A2C1D", accent: "#E8B04B" },
  { id: "matcha", name: "Matcha", brand: "#1F6B4A", accent: "#C9F24D" },
  { id: "saffron", name: "Saffron", brand: "#B8410E", accent: "#FFC93D" },
  { id: "midnight", name: "Midnight", brand: "#12233F", accent: "#4ED8C4" },
  { id: "rose", name: "Rose", brand: "#B01B57", accent: "#FFD1E0" },
  { id: "indigo", name: "Indigo Chai", brand: "#2E3A8C", accent: "#F2A65A" },
  { id: "forest", name: "Forest", brand: "#204A3B", accent: "#EFE3B8" },
  { id: "cobalt", name: "Cobalt", brand: "#1550C4", accent: "#FFE24D" },
  { id: "charcoal", name: "Charcoal", brand: "#232323", accent: "#F05A28" },
];

export const DEFAULT_PALETTE = PALETTES[0];
