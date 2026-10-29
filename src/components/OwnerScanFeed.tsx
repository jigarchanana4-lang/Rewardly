"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { one } from "@/lib/utils";

interface PendingScan {
  id: string;
  customer_id: string;
  created_at: string;
  customer_name?: string | null;
  branch_name?: string | null;
}

/**
 * Live queue of pending scans for the owner. Approving calls approve_scan
 * (idempotent, SECURITY DEFINER) which awards the stamp / mints a reward.
 */
export default function OwnerScanFeed({
  restaurantId,
  rewardMode = "stamps",
}: {
  restaurantId: string;
  rewardMode?: "stamps" | "points";
}) {
  const supabase = createClient();
  const [scans, setScans] = useState<PendingScan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("scan_events")
      .select("id, customer_id, created_at, profiles:customer_id(full_name), branches:branch_id(name)")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setScans(
      (data ?? []).map((s) => ({
        id: s.id as string,
        customer_id: s.customer_id as string,
        created_at: s.created_at as string,
        customer_name: one<{ full_name?: string }>(s.profiles)?.full_name ?? null,
        branch_name: one<{ name?: string }>(s.branches)?.name ?? null,
      })),
    );
  }, [supabase, restaurantId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`owner-scans-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_events", filter: `restaurant_id=eq.${restaurantId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, restaurantId, load]);

  async function decide(id: string, approve: boolean) {
    if (approve && rewardMode === "points") {
      const raw = window.prompt("Bill amount (₹)?");
      if (raw === null) return;
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount <= 0) return setToast("Enter a valid amount");
      setBusy(id);
      const { data, error } = await supabase.rpc("approve_scan_points", { p_scan_id: id, p_amount: amount });
      if (!error) {
        const res = data as { reward_id?: string; earned?: number };
        setToast(res?.reward_id ? "🎉 Reward unlocked!" : `+${res?.earned ?? 0} points ✓`);
      }
    } else if (approve) {
      setBusy(id);
      const { data, error } = await supabase.rpc("approve_scan", { p_scan_id: id });
      if (!error) {
        const res = data as { reward_id?: string; current_stamps?: number };
        setToast(res?.reward_id ? "🎉 Reward unlocked for customer!" : "Stamp added ✓");
      }
    } else {
      setBusy(id);
      await supabase.rpc("decline_scan", { p_scan_id: id });
      setToast("Scan declined");
    }
    setBusy(null);
    setScans((s) => s.filter((x) => x.id !== id));
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="display text-xl">Pending scans</h2>
        {scans.length > 0 ? (
          <span className="chip-pink animate-ring font-mono tabular-nums">{scans.length} waiting</span>
        ) : (
          <span className="chip-soft">All clear</span>
        )}
      </div>

      {scans.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-line bg-surface p-7 text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border-2 border-dashed border-line text-ink-2">
            ✦
          </div>
          <div className="font-extrabold">Nothing waiting</div>
          <p className="mt-1 text-sm font-medium text-ink-2">
            When a customer scans your QR, they appear here for one tap.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {scans.map((s) => (
            <li
              key={s.id}
              className="animate-rise rounded-lg border-2 border-edge bg-surface p-4 shadow-pop sm:flex sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <div className="display truncate text-lg">{s.customer_name || "Customer"}</div>
                <div className="font-mono text-xs text-ink-2">
                  {new Date(s.created_at).toLocaleTimeString()}
                  {s.branch_name ? ` · ${s.branch_name}` : ""}
                </div>
              </div>
              <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
                <button
                  className="btn-ghost px-4 py-2 text-sm text-risk"
                  disabled={busy === s.id}
                  onClick={() => decide(s.id, false)}
                >
                  Decline
                </button>
                <button
                  className="btn-brand flex-1 px-5 py-2 text-sm sm:flex-none"
                  disabled={busy === s.id}
                  onClick={() => decide(s.id, true)}
                >
                  {busy === s.id ? "…" : rewardMode === "points" ? "Add points" : "Give stamp"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit animate-rise rounded-pill border-2 border-edge bg-ink px-5 py-3 text-sm font-bold text-bg shadow-pop"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
