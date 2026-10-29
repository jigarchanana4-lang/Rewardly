"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/utils";
import { REF_KEY } from "@/components/RefCapture";
import { BRAND } from "@/config/brand";

type Mode = "customer" | "business";

export default function PhoneAuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>((params.get("as") as Mode) || "customer");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = params.get("next");

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = normalizePhone(phone);
    if (!e164) return setError("Enter a valid 10-digit mobile number.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("otp");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = normalizePhone(phone)!;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }

    // Redeem a stored referral code, if any (safe no-op if invalid/self).
    const ref = typeof window !== "undefined" ? localStorage.getItem(REF_KEY) : null;
    if (ref) {
      await supabase.rpc("record_referral", { p_code: ref });
      localStorage.removeItem(REF_KEY);
    }

    // Route by intent.
    if (mode === "business") {
      await supabase
        .from("user_roles")
        .update({ role: "owner" })
        .eq("user_id", (await supabase.auth.getUser()).data.user!.id);
      router.push(nextPath || "/onboarding/owner");
    } else {
      router.push(nextPath || "/");
    }
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="eyebrow text-brand">{BRAND.name}</div>
      <h1 className="display mt-2 text-[40px]">
        {mode === "customer" ? (
          <>
            Free stuff for
            <br />
            <span className="tape bg-accent text-accent-ink">going back.</span>
          </>
        ) : (
          <>
            Turn one visit
            <br />
            into <span className="tape bg-accent text-accent-ink">ten.</span>
          </>
        )}
      </h1>
      <p className="mt-3 font-medium text-ink-2">
        {mode === "customer"
          ? "Collect stamps at the places you already love. No card, no app store."
          : "Set up your loyalty program in two minutes. Free for three days."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-pill border-2 border-edge bg-surface-2 p-1">
        {(["customer", "business"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setStep("phone");
            }}
            className={`rounded-pill py-2.5 text-sm font-bold capitalize transition ${
              mode === m ? "bg-brand text-on-brand" : "text-ink-2 hover:text-ink"
            }`}
          >
            {m === "customer" ? "I'm a customer" : "I own a shop"}
          </button>
        ))}
      </div>

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="mt-6 space-y-3">
          <label className="label" htmlFor="phone">
            Mobile number
          </label>
          <div className="flex items-center gap-3 rounded-md border-2 border-line bg-surface px-3 py-1 focus-within:border-brand">
            <span className="rounded-sm bg-surface-2 px-2 py-1.5 font-mono text-sm font-medium">+91</span>
            <input
              id="phone"
              inputMode="numeric"
              autoFocus
              className="w-full bg-transparent py-2.5 font-mono text-lg tracking-wide outline-none"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className="text-sm font-semibold text-risk">{error}</p>}
          <button className="btn-brand w-full text-base" disabled={busy}>
            {busy ? "Sending…" : "Send me a code →"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-3">
          <label className="label" htmlFor="otp">
            6-digit code sent to +91 {phone}
          </label>
          <input
            id="otp"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            className="field text-center font-mono text-3xl tracking-[0.4em]"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          {error && <p className="text-sm font-semibold text-risk">{error}</p>}
          <button className="btn-brand w-full text-base" disabled={busy}>
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button type="button" className="btn-flat w-full" onClick={() => setStep("phone")}>
            Change number
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs font-medium text-ink-2">
        By continuing you agree to {BRAND.name}&rsquo;s terms. We only use your number to sign you in.
      </p>
    </div>
  );
}
