import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { extractMenu, menuAIConfigured, type ImageMedia, type MenuImage } from "@/lib/menuAI";
import { isDevMode } from "@/lib/utils";

/** ~4MB of base64 per image, 6 images max — keeps one request bounded. */
const MAX_IMAGES = 6;
const MAX_B64_CHARS = 5_600_000;
const ALLOWED: ImageMedia[] = ["image/jpeg", "image/png", "image/webp"];

/**
 * Read photos of a physical menu and return structured items for review.
 *
 * This route only *proposes* — nothing is written to the catalogue here. The
 * owner confirms in the UI, and the existing menu insert path does the saving.
 */
export async function POST(req: Request) {
  // Vision calls cost real money, so this is tighter than the other limits.
  const rl = rateLimit(clientKey(req, "menu-import"), 10, 60 * 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: `Too many scans. Try again in ${Math.ceil(rl.retryAfter / 60)} min.` },
      { status: 429 },
    );

  const { restaurantId, images } = (await req.json()) as {
    restaurantId?: string;
    images?: MenuImage[];
  };

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  if (!Array.isArray(images) || images.length === 0)
    return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });
  if (images.length > MAX_IMAGES)
    return NextResponse.json({ error: `Up to ${MAX_IMAGES} photos at a time.` }, { status: 400 });

  for (const img of images) {
    if (!img?.data || typeof img.data !== "string")
      return NextResponse.json({ error: "Bad image payload." }, { status: 400 });
    if (!ALLOWED.includes(img.media_type))
      return NextResponse.json({ error: "Use JPG, PNG or WebP." }, { status: 400 });
    if (img.data.length > MAX_B64_CHARS)
      return NextResponse.json({ error: "One of those photos is too large (max ~4MB)." }, { status: 413 });
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .single();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  try {
    const items = await extractMenu(images);
    return NextResponse.json({
      items,
      count: items.length,
      // Tells the UI to say "sample data" rather than imply a real scan ran.
      simulated: !menuAIConfigured() && isDevMode(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that menu.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
