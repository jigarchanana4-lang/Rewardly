"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nearestBranch } from "@/lib/utils";

type ScanState = "idle" | "pending" | "approved" | "declined";
type BranchLite = { id: string; name: string; lat: number | null; lng: number | null };

/**
 * Customer-side "collect a stamp" button.
 * If the shop has GPS branches, detects the nearest one before creating the
 * pending scan (create_scan RPC), then listens on realtime for the owner's
 * approve/decline decision.
 */
export default function ScanButton({
  restaurantId,
  branches = [],
}: {
  restaurantId: string;
  branches?: BranchLite[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [scanId, setScanId] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, [supabase]);

  useEffect(() => {
    if (!scanId) return;
    const ch = supabase
      .channel(`scan-${scanId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scan_events", filter: `id=eq.${scanId}` },
        (payload) => {
          const status = (payload.new as { status: ScanState }).status;
          if (status === "approved" || status === "declined") {
            setState(status);
            if (status === "approved") setTimeout(() => router.refresh(), 1200);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [scanId, supabase, router]);

  /** Resolve the nearest branch id via GPS (best-effort; null if unavailable). */
  function resolveBranch(): Promise<string | null> {
    const geoBranches = branches.filter((b) => b.lat != null && b.lng != null);
    if (geoBranches.length === 0 || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const b = nearestBranch(geoBranches, pos.coords.latitude, pos.coords.longitude);
          if (b) setDetected(b.name);
          resolve(b?.id ?? null);
        },
        () => resolve(null),
        { timeout: 8000 },
      );
    });
  }

  async function scan() {
    setError(null);
    if (authed === false) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setState("pending");
    const branchId = await resolveBranch();
    const { data, error } = await supabase.rpc("create_scan", {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
    });
    if (error) {
      setState("idle");
      return setError(error.message);
    }
    const scan = data as { id: string; status: string };
    // Fast mode settles instantly — no waiting for staff.
    if (scan.status === "approved") {
      setState("approved");
      setTimeout(() => router.refresh(), 1200);
      return;
    }
    setScanId(scan.id);
  }

  if (state === "pending")
    return (
      <div className="card-pop text-center">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-brand" />
        <div className="display text-xl">Show this to the counter</div>
        <div className="mt-1 text-sm font-medium text-ink-2">
          Waiting for staff to approve
          {detected ? ` · ${detected}` : ""}
        </div>
      </div>
    );

  if (state === "approved")
    return (
      <div className="relative overflow-hidden rounded-lg border-2 border-edge bg-accent p-6 text-center text-accent-ink shadow-pop-lg">
        <Confetti />
        <div className="relative">
          <div className="display text-3xl">Stamp added!</div>
          <div className="mt-1 text-sm font-bold opacity-70">One step closer to your treat.</div>
        </div>
      </div>
    );

  if (state === "declined")
    return (
      <div className="rounded-lg border-2 border-risk bg-risk-soft p-5 text-center">
        <div className="display text-xl text-risk">Staff declined this scan</div>
        <p className="mt-1 text-sm font-medium text-ink-2">Ask at the counter, then try again.</p>
        <button className="btn-ghost mt-4" onClick={() => setState("idle")}>
          Try again
        </button>
      </div>
    );

  return (
    <div>
      <button className="btn-brand w-full py-4 text-lg" onClick={scan}>
        Collect a stamp
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-risk">{error}</p>}
    </div>
  );
}

/** Cheap CSS burst — twelve chips, no library, respects reduced motion. */
const CONFETTI_COLORS = ["rgb(var(--brand))", "rgb(var(--pink))", "rgb(var(--mango))", "rgb(var(--ink))"];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute block h-2.5 w-1.5 rounded-[1px]"
          style={{
            left: `${6 + i * 8}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confetti-drop ${900 + (i % 5) * 220}ms cubic-bezier(.3,.7,.4,1) ${i * 45}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
