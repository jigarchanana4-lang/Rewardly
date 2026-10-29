import { Restaurant } from "@/lib/types";

/** Points-mode ticket (spend-based rewards). Mirrors the stamp card's anatomy. */
export default function PointsCardView({
  restaurant,
  points,
}: {
  restaurant: Pick<Restaurant, "name" | "points_threshold" | "reward_title">;
  points: number;
}) {
  const target = restaurant.points_threshold;
  const remaining = Math.max(0, target - points);
  const complete = remaining === 0;
  const pct = Math.min(100, target ? (points / target) * 100 : 0);

  return (
    <div className="ticket animate-rise">
      <div className="rounded-t-[26px] bg-brand px-5 py-5 text-on-brand">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{restaurant.name}</span>
          <span className="eyebrow rounded-pill bg-on-brand/15 px-2 py-0.5">Points</span>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <span className="display text-[56px] leading-none tabular-nums">{points}</span>
          <span className="mb-1.5 text-lg font-bold opacity-70">pts</span>
          <span className="mb-2 ml-auto text-sm font-bold opacity-80">
            {complete ? "Reward unlocked!" : `${remaining} to go`}
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

      <div className="rounded-b-[26px] px-5 pb-5 pt-6">
        <div
          className={`rounded-md border-2 px-4 py-3 ${
            complete ? "border-edge bg-accent text-accent-ink" : "border-line bg-surface-2"
          }`}
        >
          <div className="label" style={complete ? { color: "rgb(var(--accent-ink))", opacity: 0.75 } : undefined}>
            {complete ? "Ready to claim" : "Your reward"}
          </div>
          <div className="display mt-0.5 text-xl">{restaurant.reward_title ?? "Free reward"}</div>
          {!complete && (
            <div className="mt-0.5 text-sm font-medium text-ink-2">
              {remaining} more points of {target}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
