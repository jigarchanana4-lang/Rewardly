"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PHRASE = "DELETE";

/** Irreversible, so it asks for a typed confirmation rather than a single tap. */
export default function DeleteAccountButton() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(json.error ?? "Could not delete your account.");
    }
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        className="w-full rounded-pill px-4 py-2.5 text-sm font-bold text-ink-2 transition hover:text-risk"
        onClick={() => setOpen(true)}
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="rounded-lg border-2 border-risk bg-risk-soft p-4">
      <div className="display text-lg text-risk">Delete your account?</div>
      <p className="mt-1 text-sm font-medium text-ink-2">
        This erases your profile, your stamps and any rewards you haven&rsquo;t used. It cannot be
        undone.
      </p>

      <label className="label mt-3 block" htmlFor="confirm">
        Type {PHRASE} to confirm
      </label>
      <input
        id="confirm"
        className="field mt-1.5 font-mono"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
      />

      {error && <p className="mt-2 text-sm font-semibold text-risk">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          className="btn-brand flex-1 bg-risk"
          disabled={typed !== PHRASE || busy}
          onClick={remove}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
        <button className="btn-flat" onClick={() => setOpen(false)} disabled={busy}>
          Keep my account
        </button>
      </div>
    </div>
  );
}
