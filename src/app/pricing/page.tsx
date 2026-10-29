import Link from "next/link";
import { BRAND, TIERS, TRIAL_DAYS } from "@/config/brand";
import { inr } from "@/lib/utils";

export const metadata = {
  title: "Pricing — loyalty plans for your business",
  description: "Simple annual plans. Stamp cards, scratch cards, digital menu and a free QR stand.",
};

export default function PricingPage() {
  const tiers = Object.values(TIERS);
  return (
    <main className="mx-auto max-w-md px-4 py-8 lg:max-w-5xl">
      <Link href="/" className="text-sm font-bold text-brand underline decoration-2 underline-offset-4">
        ← Home
      </Link>

      <h1 className="display mt-3 text-[40px] lg:text-6xl">
        Plans that pay
        <br />
        for <span className="tape bg-accent text-accent-ink">themselves.</span>
      </h1>
      <p className="mt-3 max-w-md font-medium text-ink-2">
        No hidden fees. Cancel any time. A free QR stand ships to your counter with every plan.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3 lg:items-start">
        {tiers.map((t, i) => {
          const popular = i === 1;
          const save = Math.round(((t.anchor - t.price) / t.anchor) * 100);
          return (
            <div
              key={t.id}
              className={`relative rounded-xl border-2 p-5 ${
                popular
                  ? "border-edge bg-brand text-on-brand shadow-pop-lg lg:-mt-3 lg:pb-8"
                  : "border-line bg-surface"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-5 chip-accent rotate-[-3deg]">Most popular</span>
              )}

              <div className={`eyebrow ${popular ? "opacity-70" : "text-ink-2"}`}>{t.name}</div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="display text-[44px] tabular-nums">{inr(t.price)}</span>
                <span className={`text-sm font-bold ${popular ? "opacity-70" : "text-ink-2"}`}>/ year</span>
              </div>
              <div className={`mt-1 flex items-center gap-2 text-sm ${popular ? "opacity-80" : "text-ink-2"}`}>
                <span className="font-medium line-through">{inr(t.anchor)}</span>
                <span
                  className={`chip py-0.5 ${popular ? "bg-on-brand/20 text-on-brand" : "border-line bg-accent-soft text-accent-ink"}`}
                >
                  Save {save}%
                </span>
              </div>

              <div
                className={`mt-4 rounded-md border-2 px-3 py-2 text-sm font-bold ${
                  popular ? "border-on-brand/25 bg-on-brand/10" : "border-line bg-surface-2"
                }`}
              >
                {t.maxLocations} location{t.maxLocations > 1 ? "s" : ""}
                {t.gpsBranch ? " · GPS branch detect" : ""}
              </div>

              <ul className="mt-4 space-y-2 text-sm font-semibold">
                {t.highlights.map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${
                        popular ? "bg-accent text-accent-ink" : "bg-good text-white"
                      }`}
                    >
                      ✓
                    </span>
                    {h}
                  </li>
                ))}
              </ul>

              <Link
                href={`/pay/${t.id}`}
                className={`mt-5 w-full ${popular ? "btn-accent" : "btn-ghost"}`}
              >
                Start {TRIAL_DAYS}-day free trial
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs font-medium text-ink-2">
        Customers always use {BRAND.name} for free. Prices exclude applicable taxes.
      </p>
    </main>
  );
}
