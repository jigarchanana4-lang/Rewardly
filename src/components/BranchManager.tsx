"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Branch } from "@/lib/types";

/**
 * Manage physical locations. One QR (per shop) auto-detects the nearest branch
 * by GPS at scan time. Tier-gated: Growth/Pro only, capped at maxLocations.
 */
export default function BranchManager({
  restaurantId,
  initial,
  maxLocations,
  gpsEnabled,
}: {
  restaurantId: string;
  initial: Branch[];
  maxLocations: number;
  gpsEnabled: boolean;
}) {
  const supabase = createClient();
  const [branches, setBranches] = useState<Branch[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  if (!gpsEnabled) {
    return (
      <div className="card mt-4">
        <div className="font-semibold">Multiple locations</div>
        <p className="mt-1 text-sm text-ink-2">
          One QR across all your branches, auto-detected by GPS, is available on the Growth and Pro plans.
        </p>
        <Link href="/pricing" className="btn-ghost mt-3">
          Upgrade
        </Link>
      </div>
    );
  }

  const atCap = branches.length >= maxLocations;

  async function addBranch() {
    if (atCap) return;
    const { data, error } = await supabase
      .from("branches")
      .insert({ restaurant_id: restaurantId, name: `Branch ${branches.length + 1}` })
      .select("*")
      .single<Branch>();
    if (error) return setError(error.message);
    if (data) setBranches([...branches, data]);
  }

  async function update(id: string, patch: Partial<Branch>) {
    setBranches((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    await supabase.from("branches").update(patch).eq("id", id);
  }

  async function remove(id: string) {
    await supabase.from("branches").delete().eq("id", id);
    setBranches(branches.filter((b) => b.id !== id));
  }

  function useMyLocation(id: string) {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update(id, {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Enter coordinates manually.");
        setLocating(false);
      },
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Locations</div>
          <div className="text-xs text-ink-2">
            {branches.length}/{maxLocations} used · nearest is auto-detected on scan
          </div>
        </div>
        <button className="btn-ghost px-4 disabled:opacity-40" onClick={addBranch} disabled={atCap}>
          + Add
        </button>
      </div>

      {error && <p className="text-sm text-risk">{error}</p>}

      {branches.map((b) => (
        <div key={b.id} className="card space-y-2">
          <div className="flex gap-2">
            <input
              className="field flex-1"
              value={b.name}
              onChange={(e) => update(b.id, { name: e.target.value })}
              placeholder="Branch name"
            />
            <button className="btn-ghost px-3 text-risk" onClick={() => remove(b.id)}>
              ✕
            </button>
          </div>
          <input
            className="field"
            value={b.address ?? ""}
            onChange={(e) => update(b.id, { address: e.target.value })}
            placeholder="Address"
          />
          <div className="flex items-center gap-2">
            <input
              className="field w-full tabular-nums"
              value={b.lat ?? ""}
              inputMode="decimal"
              onChange={(e) => update(b.id, { lat: e.target.value ? Number(e.target.value) : null })}
              placeholder="Latitude"
            />
            <input
              className="field w-full tabular-nums"
              value={b.lng ?? ""}
              inputMode="decimal"
              onChange={(e) => update(b.id, { lng: e.target.value ? Number(e.target.value) : null })}
              placeholder="Longitude"
            />
          </div>
          <button className="btn-ghost w-full text-sm" onClick={() => useMyLocation(b.id)} disabled={locating}>
            {locating ? "Locating…" : "📍 Use my current location"}
          </button>
          {(b.lat == null || b.lng == null) && (
            <p className="text-xs text-warn">Add coordinates so this branch can be auto-detected.</p>
          )}
        </div>
      ))}

      {branches.length === 0 && (
        <div className="card text-center text-ink-2">
          No extra locations yet. Add one to enable GPS branch detection.
        </div>
      )}
    </div>
  );
}
