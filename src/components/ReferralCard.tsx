"use client";

import { useState } from "react";
import { BRAND } from "@/config/brand";

export default function ReferralCard({
  code,
  referredCount,
}: {
  code: string;
  referredCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${code}`
      : `/?ref=${code}`;

  const message = `Join me on ${BRAND.name} and earn free rewards at local shops! ${link}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: BRAND.name, text: message, url: link });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-edge bg-brand p-5 text-on-brand shadow-pop">
      <div className="flex items-center justify-between">
        <div className="label text-on-brand/80">Refer &amp; earn</div>
        {referredCount > 0 && (
          <span className="chip bg-on-brand/20 text-on-brand">{referredCount} joined</span>
        )}
      </div>
      <p className="mt-1 font-semibold">
        Invite a friend — when they collect their first stamp, you get a bonus stamp too. 🎁
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-on-brand/15 px-3 py-2">
        <code className="flex-1 truncate font-mono text-sm">{link}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-pill bg-on-brand/25 px-3 py-1 text-xs font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <button onClick={share} className="btn-accent mt-3 w-full">
        Share invite
      </button>
    </div>
  );
}
