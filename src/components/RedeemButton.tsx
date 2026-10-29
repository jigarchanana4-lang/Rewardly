"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** One tap for the owner to mark a reward redeemed (matches the customer's code). */
export default function RedeemButton({ rewardId, code }: { rewardId: string; code: string }) {
  const supabase = createClient();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function redeem() {
    setState("busy");
    const { error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId });
    setState(error ? "idle" : "done");
  }

  if (state === "done") return <span className="chip border-edge bg-good text-white">Redeemed ✓</span>;

  return (
    <button className="btn-brand px-4 py-2 text-sm" onClick={redeem} disabled={state === "busy"}>
      {state === "busy" ? "…" : `Redeem ${code}`}
    </button>
  );
}
