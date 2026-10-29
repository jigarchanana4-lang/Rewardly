/**
 * Provider-agnostic image model access.
 *
 * Any key works: set IMAGE_PROVIDER + IMAGE_API_KEY (+ IMAGE_MODEL) and the
 * adapter below shapes the request. Swapping provider is an env change, not a
 * code change — which matters because per-image pricing moves constantly.
 *
 * HARD RULE: image-to-image only. Every operation takes the owner's real
 * photograph as input and returns a corrected version of it. There is no
 * text-to-image path, deliberately. A generated dish that doesn't match what
 * arrives at the table is a consumer complaint and a Swiggy/Zomato policy
 * problem for the restaurant — the guardrail belongs in the code, not in a
 * style guide someone can forget.
 */

export type ProviderId = "fal" | "replicate" | "openai" | "stability";

export interface ImageOp {
  id: string;
  name: string;
  hint: string;
  /** Credits charged on success. */
  cost: number;
  prompt: string;
  /** 0..1 — how far the model may move from the original. Kept low on purpose. */
  strength: number;
}

/**
 * Strength is capped at 0.45 across every operation. Above roughly that,
 * image-to-image stops correcting the photograph and starts reinventing the
 * food.
 */
export const MAX_STRENGTH = 0.45;

export const IMAGE_OPS: Record<string, ImageOp> = {
  relight: {
    id: "relight",
    name: "Studio light",
    hint: "Soft, even lighting like a photo studio",
    cost: 2,
    prompt:
      "Relight this exact dish with soft, even, professional food-photography lighting. Keep the same food, same plate, same garnish, same portion and same composition. Do not add, remove or substitute any ingredient.",
    strength: 0.35,
  },
  cleanup: {
    id: "cleanup",
    name: "Tidy background",
    hint: "Removes clutter behind the plate",
    cost: 2,
    prompt:
      "Remove background clutter behind this exact dish and replace it with a clean, simple surface. Keep the food itself completely unchanged — same ingredients, same plating, same portion.",
    strength: 0.4,
  },
  upscale: {
    id: "upscale",
    name: "Sharpen & enlarge",
    hint: "For printed menus",
    cost: 1,
    prompt:
      "Increase the resolution and clarity of this photograph without altering its content in any way.",
    strength: 0.2,
  },
};

export interface GenResult {
  /** Raw base64 of the returned image. */
  data: string;
  mediaType: string;
}

export function imageProvider(): { id: ProviderId; key: string; model: string } | null {
  const id = process.env.IMAGE_PROVIDER as ProviderId | undefined;
  const key = process.env.IMAGE_API_KEY;
  if (!id || !key) return null;
  return { id, key, model: process.env.IMAGE_MODEL ?? DEFAULT_MODELS[id] };
}

const DEFAULT_MODELS: Record<ProviderId, string> = {
  fal: "fal-ai/flux/dev/image-to-image",
  replicate: "black-forest-labs/flux-dev",
  openai: "gpt-image-1",
  stability: "sd3.5-medium",
};

/** Clamp whatever an operation asks for to the safety ceiling. */
export function safeStrength(s: number): number {
  return Math.max(0, Math.min(MAX_STRENGTH, s));
}

export async function runImageOp(
  op: ImageOp,
  imageB64: string,
  signal?: AbortSignal,
): Promise<GenResult> {
  const p = imageProvider();
  if (!p) throw new Error("No image provider configured.");

  const strength = safeStrength(op.strength);
  const dataUri = `data:image/jpeg;base64,${imageB64}`;

  switch (p.id) {
    case "fal": {
      const res = await fetch(`https://fal.run/${p.model}`, {
        method: "POST",
        headers: { Authorization: `Key ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: dataUri, prompt: op.prompt, strength }),
        signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail ?? "Image provider rejected the request.");
      const url = json?.images?.[0]?.url;
      if (!url) throw new Error("Provider returned no image.");
      return fetchAsBase64(url, signal);
    }

    case "replicate": {
      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.key}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          model: p.model,
          input: { image: dataUri, prompt: op.prompt, prompt_strength: strength },
        }),
        signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail ?? "Image provider rejected the request.");
      const out = Array.isArray(json?.output) ? json.output[0] : json?.output;
      if (!out) throw new Error("Provider returned no image.");
      return fetchAsBase64(out, signal);
    }

    case "openai": {
      const form = new FormData();
      form.append("model", p.model);
      form.append("prompt", op.prompt);
      form.append("image", new Blob([Buffer.from(imageB64, "base64")], { type: "image/jpeg" }), "photo.jpg");
      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}` },
        body: form,
        signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Image provider rejected the request.");
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error("Provider returned no image.");
      return { data: b64, mediaType: "image/png" };
    }

    case "stability": {
      const form = new FormData();
      form.append("image", new Blob([Buffer.from(imageB64, "base64")], { type: "image/jpeg" }), "photo.jpg");
      form.append("prompt", op.prompt);
      form.append("strength", String(strength));
      form.append("mode", "image-to-image");
      form.append("output_format", "jpeg");
      const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/sd3`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, Accept: "application/json" },
        body: form,
        signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.errors?.[0] ?? "Image provider rejected the request.");
      if (!json?.image) throw new Error("Provider returned no image.");
      return { data: json.image, mediaType: "image/jpeg" };
    }
  }
}

async function fetchAsBase64(url: string, signal?: AbortSignal): Promise<GenResult> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Could not download the generated image.");
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: res.headers.get("content-type") ?? "image/jpeg" };
}
