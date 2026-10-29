import Link from "next/link";
import { Restaurant } from "@/lib/types";

/** Tint the logo tile by first letter so a list of shops reads as varied. */
const TINTS = [
  "bg-brand-soft text-brand",
  "bg-pink-soft text-pink",
  "bg-mango-soft text-mango",
  "bg-accent-soft text-accent-ink",
];

export default function RestaurantCard({
  r,
}: {
  r: Pick<Restaurant, "name" | "slug" | "category" | "logo_url" | "reward_title" | "address">;
}) {
  const tint = TINTS[r.name.charCodeAt(0) % TINTS.length];

  return (
    <Link
      href={`/shop/${r.slug}`}
      className="group block rounded-lg border-2 border-line bg-surface p-4 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-edge hover:shadow-pop active:translate-y-0 active:shadow-none"
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-edge text-xl font-extrabold ${tint}`}
        >
          {r.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            r.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="display truncate text-lg">{r.name}</div>
          <div className="truncate text-sm font-medium text-ink-2">
            {r.category ? <span className="capitalize">{r.category}</span> : "Local business"}
            {r.address ? ` · ${r.address}` : ""}
          </div>
        </div>
        <span className="text-ink-2 transition group-hover:translate-x-0.5 group-hover:text-brand">→</span>
      </div>

      {r.reward_title && (
        <div className="mt-3 flex items-center gap-2 rounded-md border-2 border-dashed border-line bg-surface-2 px-3 py-2">
          <span className="label shrink-0">Earn</span>
          <span className="truncate text-sm font-bold">{r.reward_title}</span>
        </div>
      )}
    </Link>
  );
}
