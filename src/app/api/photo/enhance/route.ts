import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { IMAGE_OPS, imageProvider, runImageOp } from "@/lib/imageGen";

/**
 * Run a model-powered photo operation, paid for in credits.
 *
 * Ordering is deliberate: charge FIRST, then call the provider, then refund if
 * the provider fails. The alternative (call first, charge on success) lets a
 * caller fire many concurrent requests against a balance of one and have them
 * all succeed — every check would pass before any charge landed.
 *
 * Both the charge and the refund are keyed on the same requestId, so a retried
 * request charges once and a double failure refunds once.
 */

const MAX_B64 = 5_600_000; // ~4MB
const TIMEOUT_MS = 90_000;

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "photo-enhance"), 40, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });

  const { restaurantId, operation, image, requestId } = (await req.json()) as {
    restaurantId?: string;
    operation?: string;
    image?: string;
    requestId?: string;
  };

  const op = operation ? IMAGE_OPS[operation] : undefined;
  if (!restaurantId || !op) return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  if (!image || typeof image !== "string")
    return NextResponse.json({ error: "No image supplied." }, { status: 400 });
  if (image.length > MAX_B64)
    return NextResponse.json({ error: "That photo is too large (max ~4MB)." }, { status: 413 });
  // Client-supplied so a retry of the *same* attempt is recognised as one charge.
  if (!requestId || requestId.length > 100)
    return NextResponse.json({ error: "Missing request id." }, { status: 400 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const svc = createServiceClient();
  const { data: rest } = await svc
    .from("restaurants")
    .select("id, owner_id, credits")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest || rest.owner_id !== auth.user.id)
    return NextResponse.json({ error: "not authorized" }, { status: 403 });

  if (!imageProvider()) {
    return NextResponse.json(
      { error: "Photo studio upgrades aren't switched on for this server yet." },
      { status: 503 },
    );
  }

  // 1. Charge.
  const { data: balance, error: spendErr } = await svc.rpc("spend_credits", {
    p_restaurant_id: restaurantId,
    p_amount: op.cost,
    p_operation: `photo.${op.id}`,
    p_request_id: requestId,
  });

  if (spendErr) {
    const broke = /insufficient/i.test(spendErr.message);
    return NextResponse.json(
      {
        error: broke
          ? `You need ${op.cost} credit${op.cost === 1 ? "" : "s"} for this. Top up to continue.`
          : spendErr.message,
        needsCredits: broke,
      },
      { status: broke ? 402 : 500 },
    );
  }

  // 2. Run.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await runImageOp(op, image, controller.signal);
    return NextResponse.json({
      image: result.data,
      mediaType: result.mediaType,
      creditsLeft: balance,
      spent: op.cost,
    });
  } catch (err) {
    // 3. Refund — the owner must never pay for a photo they didn't get.
    await svc.rpc("add_credits", {
      p_restaurant_id: restaurantId,
      p_amount: op.cost,
      p_kind: "refund",
      p_request_id: `refund:${requestId}`,
      p_note: `Refund for failed photo.${op.id}`,
    });
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "That took too long. Your credits have been returned."
        : "Could not process that photo. Your credits have been returned.";
    return NextResponse.json({ error: message, refunded: op.cost }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
