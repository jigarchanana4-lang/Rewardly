"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";

const NAV = [
  { href: "/owner", label: "Dashboard", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { href: "/owner/analytics", label: "Analytics", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/owner/campaigns", label: "Campaigns", icon: "M3 8l9 6 9-6M3 8v10h18V8M3 8l9-4 9 4" },
  { href: "/owner/menu", label: "Menu", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/owner/photos", label: "Photos", icon: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M8.5 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" },
  { href: "/owner/review-qr", label: "Review QR", icon: "M12 2l2.9 6.3 6.6.8-4.9 4.6 1.3 6.5L12 17l-5.9 3.2 1.3-6.5L2.5 9.1l6.6-.8z" },
  { href: "/owner/billing", label: "Billing", icon: "M2 7h20v10H2zM2 11h20M6 15h4" },
  {
    href: "/owner/settings",
    label: "Settings",
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-4l-.3 2.4a7 7 0 00-1.7 1l-2.4-1-2 3.4L4 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.4h4l.3-2.4a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z",
  },
];

/** Desktop-only sidebar for the business dashboard. Hidden on mobile. */
export default function OwnerSidebar() {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r-2 border-line bg-surface px-4 py-6 lg:flex">
      <Link href="/owner" className="mb-8 flex items-center gap-2 px-2">
        <span className="display text-2xl text-brand">{BRAND.name}</span>
        <span className="chip-soft py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]">Biz</span>
      </Link>

      <nav className="flex flex-col gap-1.5">
        {NAV.map((n) => {
          const active = path === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md border-2 px-3 py-2.5 text-sm font-bold transition ${
                active
                  ? "border-edge bg-brand text-on-brand shadow-pop"
                  : "border-transparent text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={n.icon} />
              </svg>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <Link
          href="/"
          className="rounded-md px-3 py-2.5 text-sm font-bold text-ink-2 transition hover:bg-surface-2 hover:text-ink"
        >
          Customer view →
        </Link>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/");
            router.refresh();
          }}
          className="rounded-md px-3 py-2.5 text-left text-sm font-bold text-risk transition hover:bg-risk-soft"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
