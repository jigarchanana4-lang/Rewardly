export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

/** Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (raw.startsWith("+") && digits.length >= 11) return "+" + digits;
  return null;
}

export const isDevMode = () => process.env.DEV_MODE === "true";
export const DEV_OTP = "000000";

/**
 * Supabase types embedded to-one joins as arrays, but returns a single object
 * at runtime. Normalise either shape to one object (or null).
 */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Pick the nearest branch (with coordinates) to a point. */
export function nearestBranch<T extends { lat: number | null; lng: number | null }>(
  branches: T[],
  lat: number,
  lng: number,
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const b of branches) {
    if (b.lat == null || b.lng == null) continue;
    const d = haversineKm(lat, lng, b.lat, b.lng);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
