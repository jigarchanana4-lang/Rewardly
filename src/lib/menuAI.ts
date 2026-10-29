import Anthropic from "@anthropic-ai/sdk";
import { isDevMode } from "@/lib/utils";

/**
 * Read a photographed menu into structured items.
 *
 * Vision extraction is a proposal, never a commit: the owner reviews and edits
 * everything before it's saved. Indian menus mix scripts, handwriting and
 * inconsistent price formats, so treating the model's output as final would
 * silently corrupt a real catalogue.
 */

/** Sonnet is the right tier here — fast and cheap for structured vision reads. */
const MODEL = "claude-sonnet-5";
const MAX_IMAGES = 6;

export type ImageMedia = "image/jpeg" | "image/png" | "image/webp";

export interface ExtractedItem {
  category: string;
  name: string;
  description: string | null;
  price: number | null;
}

export interface MenuImage {
  media_type: ImageMedia;
  /** Raw base64, no data: prefix. */
  data: string;
}

const SYSTEM = `You read photographs of restaurant, café and salon menus and return their contents as structured data.

Rules:
- Return ONE JSON object: {"items":[{"category","name","description","price"}]}
- "category" is the section heading the item sits under (e.g. "Hot Coffee", "Starters"). If a menu has no headings, use "Menu".
- "name" is the item name exactly as printed, minus decorative symbols.
- "description" is the printed sub-line, or null. Never invent one.
- "price" is a NUMBER in rupees, digits only (e.g. 180). Strip "₹", "Rs.", "/-" and commas. If an item shows several sizes, use the smallest price. If no price is legible, use null.
- Transliterate Devanagari or regional-script item names into Latin script as commonly written on Indian menus (e.g. "मसाला चाय" -> "Masala Chai").
- Skip anything that is not a menu item: addresses, phone numbers, GST notes, taxes, timings, "all prices inclusive" lines.
- If a value is unreadable, omit the item rather than guessing.
- Output JSON only. No prose, no code fences.`;

/** Deterministic sample so the flow is testable without an API key. */
function devSample(): ExtractedItem[] {
  return [
    { category: "Hot Coffee", name: "Filter Coffee", description: "South Indian, twice-pulled", price: 90 },
    { category: "Hot Coffee", name: "Cappuccino", description: null, price: 150 },
    { category: "Cold Coffee", name: "Cold Brew", description: "18-hour steep", price: 180 },
    { category: "Bakes", name: "Bun Maska", description: "With extra butter", price: 70 },
    { category: "Bakes", name: "Chocolate Croissant", description: null, price: 160 },
  ];
}

export function menuAIConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function extractMenu(images: MenuImage[]): Promise<ExtractedItem[]> {
  if (images.length === 0) return [];

  // No key configured: behave like the other integrations in DEV_MODE and
  // return a sample rather than failing, so the whole flow stays testable.
  if (!menuAIConfigured()) {
    if (isDevMode()) return devSample();
    throw new Error("Menu scanning is not configured on this server.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images.slice(0, MAX_IMAGES).map(
            (img) =>
              ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: img.media_type, data: img.data },
              }),
          ),
          {
            type: "text" as const,
            text: "Extract every menu item from these photos as JSON.",
          },
        ],
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return parseItems(text);
}

/** Tolerant parse — the model is instructed to return bare JSON, but a stray
 *  code fence or preamble shouldn't lose the owner their whole upload. */
export function parseItems(raw: string): ExtractedItem[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }

  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const out: ExtractedItem[] = [];

  for (const it of items) {
    const r = it as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;

    const category = typeof r.category === "string" && r.category.trim() ? r.category.trim() : "Menu";
    const key = `${category.toLowerCase()}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rawPrice = typeof r.price === "string" ? globalThis.Number(r.price.replace(/[^\d.]/g, "")) : r.price;
    const price =
      typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice > 0
        ? Math.round(rawPrice)
        : null;

    const description =
      typeof r.description === "string" && r.description.trim() ? r.description.trim() : null;

    out.push({ category, name, description, price });
  }

  return out;
}
