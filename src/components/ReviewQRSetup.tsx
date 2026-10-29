"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";
import ReviewQRCard from "@/components/ReviewQRCard";

const DEFAULT_PROMPT = "Enjoyed your visit? Tell us in 20 seconds.";

export default function ReviewQRSetup({
  restaurantId,
  slug,
  shopName,
  siteUrl,
  initialUrl,
  initialPrompt,
  initialEnabled,
  brandColor,
}: {
  restaurantId: string;
  slug: string;
  shopName: string;
  siteUrl: string;
  initialUrl: string | null;
  initialPrompt: string | null;
  initialEnabled: boolean;
  brandColor: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [prompt, setPrompt] = useState(initialPrompt ?? DEFAULT_PROMPT);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = !url || /^https?:\/\/.+/i.test(url.trim());
  const scanUrl = `${siteUrl}/r/${slug}`;

  async function save() {
    if (!valid) return setError("That doesn't look like a link — it should start with https://");
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("restaurants")
      .update({
        google_review_url: url.trim() || null,
        google_review_text: prompt.trim() || null,
        review_qr_enabled: enabled,
      })
      .eq("id", restaurantId);
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-7 space-y-6">
      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="review-url">
            Your Google review link
          </label>
          <input
            id="review-url"
            className="field mt-1.5"
            placeholder="https://g.page/r/…/review"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSaved(false);
            }}
          />
          <p className="mt-1.5 text-xs font-medium text-ink-2">
            Google Business Profile → <span className="font-bold">Ask for reviews</span> → copy the
            link. It usually starts with <span className="font-mono">g.page</span>.
          </p>
          {!valid && <p className="mt-1 text-xs font-semibold text-risk">Must start with https://</p>}
        </div>

        <div>
          <label className="label" htmlFor="prompt">
            What the card says
          </label>
          <input
            id="prompt"
            className="field mt-1.5"
            value={prompt}
            maxLength={70}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSaved(false);
            }}
          />
        </div>

        <label className="flex items-start gap-3 rounded-md border-2 border-line bg-surface-2 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setSaved(false);
            }}
          />
          <span>
            <span className="font-bold">Review QR active</span>
            <span className="mt-0.5 block text-sm font-medium text-ink-2">
              Turn off to make printed cards fall back to your shop page.
            </span>
          </span>
        </label>

        {error && <p className="text-sm font-semibold text-risk">{error}</p>}

        <div className="flex items-center gap-3">
          <button className="btn-brand" onClick={save} disabled={busy || !valid}>
            {busy ? "Saving…" : "Save"}
          </button>
          {saved && <span className="chip border-edge bg-good text-white">Saved ✓</span>}
        </div>
      </div>

      {url ? (
        <ReviewQRCard
          url={scanUrl}
          shopName={shopName}
          prompt={prompt || DEFAULT_PROMPT}
          brandColor={brandColor || BRAND.colors.brand}
        />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-line bg-surface p-6 text-center">
          <div className="display text-lg">Add your review link to get the card</div>
          <p className="mt-1 text-sm font-medium text-ink-2">
            Paste it above and your printable table card appears here.
          </p>
        </div>
      )}

      <p className="text-xs font-medium text-ink-2">
        Offer the card to every customer, not a chosen few — Google prohibits asking only happy
        customers for reviews and can penalise listings that do. The QR wins on speed, not selection.
      </p>
    </div>
  );
}
