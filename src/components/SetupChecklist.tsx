import Link from "next/link";

interface Item {
  label: string;
  done: boolean;
  href: string;
}

/** Lightweight activation nudge for new shops. Hides itself once set up. */
export default function SetupChecklist({ items }: { items: Item[] }) {
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="mb-5 rounded-lg border-2 border-edge bg-surface p-4 shadow-pop">
      <div className="flex items-center justify-between gap-3">
        <div className="display text-lg">Finish setting up</div>
        <span className="chip-accent font-mono tabular-nums">
          {done}/{items.length}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-surface-2">
        <div className="h-full rounded-pill bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-3.5 space-y-1">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition hover:bg-surface-2"
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold ${
                  it.done ? "border-edge bg-good text-white" : "border-dashed border-line text-ink-2"
                }`}
              >
                {it.done ? "✓" : ""}
              </span>
              <span className={it.done ? "font-medium text-ink-2 line-through" : "font-bold"}>{it.label}</span>
              {!it.done && <span className="ml-auto text-ink-2">→</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
