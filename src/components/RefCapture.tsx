"use client";

import { useEffect } from "react";

export const REF_KEY = "rewardly_ref";

/**
 * Persists a ?ref=CODE from the landing URL so it survives the sign-in journey.
 * Consumed once after auth by PhoneAuthForm (record_referral RPC).
 */
export default function RefCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) localStorage.setItem(REF_KEY, code.toUpperCase());
  }, []);
  return null;
}
