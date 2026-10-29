"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Customer control: receive offers/updates or not. Respected by campaigns + push. */
export default function MarketingToggle({ initial }: { initial: boolean }) {
  const supabase = createClient();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !on;
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from("profiles").update({ marketing_opt_in: next }).eq("id", auth.user.id);
      setOn(next);
    }
    setBusy(false);
  }

  return (
    <button
      className="btn-ghost w-full justify-between"
      onClick={toggle}
      disabled={busy}
      role="switch"
      aria-checked={on}
    >
      <span>Offers &amp; updates</span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-brand" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
