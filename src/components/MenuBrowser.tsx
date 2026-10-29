"use client";

import { useMemo, useState } from "react";
import type { MenuCategory, MenuItem } from "@/lib/types";

/**
 * The customer's view of a menu. Optimised for someone standing at a counter or
 * sitting at a table on their phone: search first, sticky category jump, prices
 * aligned. Items with no category fall into "More" rather than disappearing.
 */
export default function MenuBrowser({
  categories,
  items,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
}) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (m: MenuItem) =>
      !needle ||
      m.name.toLowerCase().includes(needle) ||
      (m.description ?? "").toLowerCase().includes(needle);

    const known = categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: items.filter((i) => i.category_id === c.id && match(i)),
    }));

    // Uncategorised items must still be reachable — a menu that silently hides
    // dishes is worse than one with an untidy heading.
    const orphans = items.filter((i) => !categories.some((c) => c.id === i.category_id) && match(i));
    if (orphans.length) known.push({ id: "__more", name: "More", items: orphans });

    return known.filter((g) => g.items.length > 0);
  }, [categories, items, q]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <input
        type="search"
        className="field"
        placeholder="Search the menu…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search the menu"
      />

      {groups.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
          {groups.map((g) => (
            <a
              key={g.id}
              href={`#cat-${g.id}`}
              className="chip shrink-0 whitespace-nowrap border-line bg-surface text-ink-2 hover:text-ink"
            >
              {g.name}
            </a>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-line bg-surface p-8 text-center">
          <div className="display text-lg">Nothing matches &ldquo;{q}&rdquo;</div>
          <button className="btn-flat mt-3" onClick={() => setQ("")}>
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-7">
          {groups.map((g) => (
            <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-4">
              <h2 className="display mb-2.5 text-xl">{g.name}</h2>
              <ul className="space-y-2">
                {g.items.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-md border-2 border-line bg-surface px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold">{m.name}</div>
                      {m.description && (
                        <div className="mt-0.5 text-sm font-medium text-ink-2">{m.description}</div>
                      )}
                    </div>
                    {m.price != null && (
                      <div className="shrink-0 font-mono font-bold tabular-nums">₹{m.price}</div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
