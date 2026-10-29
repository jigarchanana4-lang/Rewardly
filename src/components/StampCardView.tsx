import { Restaurant } from "@/lib/types";

/** Deterministic per-index tilt so the card looks hand-stamped, not printed. */
const TILTS = [-7, 5, -3, 8, -6, 4, -9, 6, -4, 7, -5, 3];

/** The signature object: a tear-off loyalty ticket with punched stamps. */
export default function StampCardView({
  restaurant,
  current,
}: {
  restaurant: Pick<Restaurant, "name" | "stamps_required" | "reward_title" | "logo_url">;
  current: number;
}) {
  const total = restaurant.stamps_required;
  const filled = Math.min(current, total);
  const remaining = Math.max(0, total - current);
  const complete = remaining === 0;
  const pct = Math.min(100, total ? (filled / total) * 100 : 0);

  return (
    <div className="ticket animate-rise">
      {/* Stub */}
      <div className="rounded-t-[26px] bg-brand px-5 py-5 text-on-brand">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{restaurant.name}</span>
          <span className="eyebrow rounded-pill bg-on-brand/15 px-2 py-0.5">Loyalty</span>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <span className="display text-[56px] tabular-nums leading-none">{filled}</span>
          <span className="mb-1.5 text-lg font-bold opacity-70">/ {total}</span>
          <span className="mb-2 ml-auto text-sm font-bold opacity-80">
            {complete ? "Full card!" : `${remaining} to go`}
          </span>
        </div>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-pill bg-on-brand/20">
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="perf" />

      {/* Counterfoil */}
      <div className="rounded-b-[26px] px-5 pb-5 pt-6">
        <div
          className={`rounded-md border-2 px-4 py-3 ${
            complete ? "border-edge bg-accent text-accent-ink" : "border-line bg-surface-2"
          }`}
        >
          <div className="label" style={complete ? { color: "rgb(var(--accent-ink))", opacity: 0.75 } : undefined}>
            {complete ? "Ready to claim" : "Your next treat"}
          </div>
          <div className="display mt-0.5 text-xl">{restaurant.reward_title ?? "Free reward"}</div>
          {!complete && (
            <div className="mt-0.5 text-sm font-medium text-ink-2">
              {remaining} more stamp{remaining === 1 ? "" : "s"} and it&rsquo;s yours
            </div>
          )}
        </div>

        <div className="mb-2 mt-5 label">Stamp card</div>
        <div className="grid grid-cols-5 gap-2.5">
          {Array.from({ length: total }).map((_, i) => {
            const on = i < filled;
            const tilt = TILTS[i % TILTS.length];
            return (
              <div
                key={i}
                className={on ? (complete ? "stamp-ready" : "stamp-on") : "stamp-off"}
                style={
                  on
                    ? ({
                        transform: `rotate(${tilt}deg)`,
                        animationDelay: `${Math.min(i, 9) * 45}ms`,
                        "--tilt": `${tilt}deg`,
                      } as React.CSSProperties)
                    : undefined
                }
                aria-label={on ? "Stamp collected" : `Stamp ${i + 1} empty`}
              >
                {on ? "★" : <span className="text-xs opacity-60">{i + 1}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
