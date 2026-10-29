"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/explore", label: "Explore", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM8 16l2-6 6-2-2 6-6 2z" },
  { href: "/rewards", label: "Rewards", icon: "M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7a3 3 0 10-3-3" },
  { href: "/profile", label: "Profile", icon: "M12 12a5 5 0 100-10 5 5 0 000 10zM4 22a8 8 0 0116 0" },
];

/** Floating pill nav. Four honest destinations — no decorative centre button. */
export default function BottomNav() {
  const path = usePathname();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <nav className="pointer-events-auto mx-auto mb-3 flex w-[min(26rem,calc(100%-2rem))] items-center gap-1 rounded-pill border border-white/40 bg-surface/70 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-md backdrop-saturate-150 transform-gpu [will-change:transform] dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
        {items.map((it) => {
          const active = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-pill py-2 text-[10px] font-bold transition ${
                active ? "bg-brand/90 text-on-brand shadow-sm" : "text-ink-2 hover:bg-white/30 hover:text-ink dark:hover:bg-white/10"
              }`}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={it.icon} />
              </svg>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
