import Link from "next/link";
import { BRAND } from "@/config/brand";

export const metadata = { title: "Payment successful" };

export default function PaymentSuccess() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-good-soft text-4xl">✅</div>
      <h1 className="mt-5 display text-2xl">You’re all set!</h1>
      <p className="mt-2 text-ink-2">
        Your {BRAND.name} plan is active and your free QR stand is on its way. A receipt has been emailed to you.
      </p>
      <div className="mt-6 w-full space-y-2">
        <Link href="/owner" className="btn-brand w-full">
          Go to dashboard
        </Link>
        <Link href="/owner/settings" className="btn-ghost w-full">
          Finish setting up
        </Link>
      </div>
    </main>
  );
}
