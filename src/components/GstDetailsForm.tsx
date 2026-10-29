"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const STATES = [
  "Andhra Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Delhi","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Odisha","Puducherry","Punjab","Rajasthan","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

export default function GstDetailsForm({
  restaurantId,
  initialGstin,
  initialState,
  initialAddress,
}: {
  restaurantId: string;
  initialGstin: string | null;
  initialState: string | null;
  initialAddress: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [gstin, setGstin] = useState(initialGstin ?? "");
  const [state, setState] = useState(initialState ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gstinValid = !gstin || GSTIN.test(gstin.toUpperCase());

  async function save() {
    if (!gstinValid) return setError("That GSTIN doesn't look right — it's 15 characters.");
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("restaurants")
      .update({
        gstin: gstin ? gstin.toUpperCase() : null,
        billing_state: state || null,
        billing_address: address || null,
      })
      .eq("id", restaurantId);
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label" htmlFor="gstin">GSTIN (optional)</label>
        <input
          id="gstin"
          className="field mt-1.5 font-mono uppercase"
          placeholder="27AAAAA0000A1Z5"
          value={gstin}
          onChange={(e) => { setGstin(e.target.value); setSaved(false); }}
        />
        {!gstinValid && <p className="mt-1 text-xs font-semibold text-risk">15 characters, e.g. 27AAAAA0000A1Z5</p>}
      </div>

      <div>
        <label className="label" htmlFor="state">State (place of supply)</label>
        <select
          id="state"
          className="field mt-1.5"
          value={state}
          onChange={(e) => { setState(e.target.value); setSaved(false); }}
        >
          <option value="">Select your state</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="billing-address">Billing address</label>
        <input
          id="billing-address"
          className="field mt-1.5"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
        />
      </div>

      {error && <p className="text-sm font-semibold text-risk">{error}</p>}

      <div className="flex items-center gap-3">
        <button className="btn-brand" onClick={save} disabled={busy || !gstinValid}>
          {busy ? "Saving…" : "Save GST details"}
        </button>
        {saved && <span className="chip border-edge bg-good text-white">Saved ✓</span>}
      </div>
      <p className="text-xs font-medium text-ink-2">
        Applies to future invoices. Already-issued invoices are not changed — that&rsquo;s a legal
        requirement, not a limitation.
      </p>
    </div>
  );
}
