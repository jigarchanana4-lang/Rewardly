"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { TierId } from "@/config/brand";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutButton({
  restaurantId,
  tier,
  label,
}: {
  restaurantId: string;
  tier: TierId;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/razorpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tier }),
      });
      const intent = await res.json();
      if (!res.ok) throw new Error(intent.error || "Could not start checkout");

      if (!window.Razorpay) throw new Error("Payment SDK still loading — try again.");

      const options: Record<string, unknown> = {
        key: intent.keyId,
        name: "Rewardly",
        description: `${tier} plan`,
        amount: intent.amount,
        currency: "INR",
        ...(intent.mode === "subscription"
          ? { subscription_id: intent.subscriptionId }
          : { order_id: intent.orderId }),
        handler: async (resp: Record<string, string>) => {
          const verify = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: intent.mode,
              restaurantId,
              tier,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_subscription_id: resp.razorpay_subscription_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          if (verify.ok) router.push("/payment-success");
          else setError("Payment could not be verified. Contact support if charged.");
        },
        theme: { color: "#0e7c66" },
      };
      new window.Razorpay!(options).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button className="btn-accent w-full text-lg" onClick={pay} disabled={busy}>
        {busy ? "Starting…" : label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-risk">{error}</p>}
    </>
  );
}
