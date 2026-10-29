"use client";

import { useState } from "react";

export default function AdminShopControls({
  restaurantId,
  isActive,
}: {
  restaurantId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !active;
    const res = await fetch("/api/admin/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, isActive: next }),
    });
    if (res.ok) setActive(next);
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`chip shrink-0 ${active ? "bg-good-soft text-good" : "bg-risk-soft text-risk"}`}
    >
      {busy ? "…" : active ? "Active" : "Suspended"}
    </button>
  );
}
