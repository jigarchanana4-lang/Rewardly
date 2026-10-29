"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/config/brand";

type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

/** Gentle, dismissible "Add to Home Screen" banner (PWA install). */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("rewardly_install_dismissed")) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem("rewardly_install_dismissed", "1");
  }

  if (!show || !evt) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border-2 border-line bg-surface p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand">
        {BRAND.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold">Add {BRAND.name} to your home screen</div>
        <div className="text-ink-2">One tap to your rewards, every time.</div>
      </div>
      <button
        className="btn-brand shrink-0 px-3 py-1.5 text-sm"
        onClick={() => {
          evt.prompt();
          dismiss();
        }}
      >
        Add
      </button>
      <button aria-label="Dismiss" className="shrink-0 px-1 text-ink-2" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
