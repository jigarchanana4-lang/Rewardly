"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "images";
const MAX_MB = 5;

/**
 * Uploads an image to Supabase Storage (bucket "images", under the user's own
 * folder) and returns its public URL via onChange. Falls back gracefully with
 * an error message if the bucket/policies aren't set up yet.
 */
export default function ImageUpload({
  value,
  onChange,
  label,
  shape = "square",
}: {
  value: string | null;
  onChange: (url: string) => void;
  label: string;
  shape?: "square" | "wide";
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose an image.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Max ${MAX_MB}MB.`);
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      return setError("Please sign in again.");
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (upErr) {
      setBusy(false);
      return setError(upErr.message.includes("Bucket not found") ? "Run migration 0003_storage.sql to enable uploads." : upErr.message);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  }

  const box = shape === "wide" ? "aspect-[16/9] w-full" : "h-20 w-20";

  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        <div className={`grid ${box} shrink-0 place-items-center overflow-hidden rounded-md border-2 border-line bg-surface-2`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-ink-2">No image</span>
          )}
        </div>
        <label className="btn-ghost cursor-pointer text-sm">
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
          />
        </label>
        {value && (
          <button type="button" className="text-xs text-risk" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-risk">{error}</p>}
    </div>
  );
}
