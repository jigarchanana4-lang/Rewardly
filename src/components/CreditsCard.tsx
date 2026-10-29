import Link from "next/link";
import { BRAND } from "@/config/brand";

/** Balance plus what it buys. Shown on Billing and in the photo studio. */
export default function CreditsCard({
  credits,
  compact = false,
}: {
  credits: number;
  compact?: boolean;
}) {
  const low = credits < 5;

  if (compact) {
    return (
      <Link
        href="/owner/billing#credits"
        className={`chip ${low ? "border-edge bg-risk text-white" : "border-edge bg-accent text-accent-ink"}`}
      >
        <span className="font-mono tabular-nums">{credits}</span> credits
      </Link>
    );
  }

  return (
    <div id="credits" className="card scroll-mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label">Credits</div>
          <div className="display mt-0.5 text-4xl tabular-nums">{credits}</div>
        </div>
        {low && <span className="chip border-edge bg-risk text-white">Running low</span>}
      </div>

      <p className="mt-2 text-sm font-medium text-ink-2">
        Credits pay for the photo studio&rsquo;s AI upgrades. Fixing lighting and colour yourself is
        always free and unlimited — credits are only for the model-powered extras.
      </p>

      <div className="mt-4">
        <div className="label mb-2">Top up</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {BRAND.credits.packs.map((p) => (
            <Link
              key={p.id}
              href={`/pay/credits?pack=${p.id}`}
              className="rounded-md border-2 border-line bg-surface px-3 py-3 text-center transition hover:border-edge hover:shadow-pop"
            >
              <div className="display text-2xl tabular-nums">{p.credits}</div>
              <div className="text-xs font-bold text-ink-2">₹{p.price}</div>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-ink-2">
          Prices include GST. Your plan also tops you up on every renewal.
        </p>
      </div>
    </div>
  );
}
