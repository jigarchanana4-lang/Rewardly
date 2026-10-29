"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Access } from "@/lib/subscription";
import type { SubTier } from "@/lib/types";
import { TIERS } from "@/config/brand";

export default function BillingCard({
  restaurantId,
  tier,
  access,
}: {
  restaurantId: string;
  tier: SubTier | null;
  access: Access;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Cancel your subscription? Your plan stays active until the period ends.")) return;
    setBusy(true);
    await fetch("/api/subscription/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    setBusy(false);
    router.refresh();
  }

  const label =
    access.state === "trial"
      ? `Free trial · ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"} left`
      : access.state === "active"
        ? `${tier ? TIERS[tier].name : "Active"} plan · renews in ${access.daysLeft} days`
        : access.state === "expired"
          ? "Plan expired"
          : "No active plan";

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="label">Billing</div>
        <span          className={`chip ${            access.active ? "bg-good-soft text-good" : "bg-risk-soft text-risk"
          }`}
        >
          {access.state}
        </span>
      </div>
      <div className="mt-1 font-semibold">{label}</div>

      <div className="mt-3 flex gap-2">
        {access.state !== "active" ? (
          <Link href="/pricing" className="btn-brand flex-1">
            {access.state === "trial" ? "Choose a plan" : "Renew / upgrade"}
          </Link>
        ) : (
          <button className="btn-ghost flex-1 text-risk" onClick={cancel} disabled={busy}>
            {busy ? "…" : "Cancel plan"}
          </button>
        )}
      </div>
    </div>
  );
}
