import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { isDevMode } from "@/lib/utils";

/**
 * Look at a food photo and say what's wrong with it.
 *
 * Claude is vision-in / text-out — it cannot edit the image. That's the right
 * division of labour here anyway: the pixels are corrected locally by
 * lib/photo.ts, and the model does the thing it's actually good at, which is
 * telling the owner what to fix and how to shoot the next one better.
 */

const MODEL = "claude-sonnet-5";
const MAX_B64 = 5_600_000; // ~4MB

const SYSTEM = `You are a food photographer reviewing a restaurant's own photo of a dish.

Return ONE JSON object:
{"verdict":"...","fixes":["...","..."],"reshoot":["...","..."],"suggested":{"exposure":0,"contrast":0,"vibrance":0,"warmth":0,"sharpen":0}}

- "verdict": one short sentence on the photo's biggest problem. Be direct and specific. If it's already good, say so.
- "fixes": 1-3 short things to change with the sliders available (exposure, contrast, vibrance, warmth, sharpen). Plain language.
- "reshoot": 1-2 short tips for taking a better photo next time (light, angle, background, clutter). Practical for a phone camera in a small Indian restaurant.
- "suggested": numeric slider values. exposure/contrast/vibrance/warmth range -1..1, sharpen 0..1. These are ADJUSTMENTS to the real photo — you are never generating or replacing the dish.

Judge only what is in frame. Never invent ingredients or describe food that isn't visible. Output JSON only, no prose, no code fences.`;

function devSample() {
  return {
    verdict: "Underexposed and a little yellow from indoor lighting.",
    fixes: ["Lift the exposure", "Cool the warmth slightly", "Add a touch of vibrance"],
    reshoot: ["Shoot next to a window with the light to one side", "Clear the background clutter"],
    suggested: { exposure: 0.2, contrast: 0.12, vibrance: 0.2, warmth: -0.1, sharpen: 0.3 },
    simulated: true,
  };
}

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "photo-advise"), 30, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many photos. Try again shortly." }, { status: 429 });

  const { image } = (await req.json()) as { image?: string };
  if (!image || typeof image !== "string")
    return NextResponse.json({ error: "No image supplied." }, { status: 400 });
  if (image.length > MAX_B64)
    return NextResponse.json({ error: "That photo is too large (max ~4MB)." }, { status: 413 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    if (isDevMode()) return NextResponse.json(devSample());
    return NextResponse.json({ error: "Photo advice is not configured on this server." }, { status: 503 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: "Review this food photo." },
          ],
        },
      ],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Could not read the response.");
    return NextResponse.json(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return NextResponse.json({ error: "Could not review that photo." }, { status: 502 });
  }
}
