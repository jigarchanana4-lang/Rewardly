import Link from "next/link";
import { BRAND } from "@/config/brand";
import { TIERS } from "@/config/brand";

export const metadata = {
  title: "Terms, Privacy & Refunds",
  description: `Terms of service, privacy policy and refund policy for ${BRAND.name}.`,
};

export default function LegalPage() {
  const updated = "16 August 2026";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="text-sm text-brand">
        ← Home
      </Link>
      <h1 className="mt-2 display text-3xl">Legal</h1>
      <p className="mt-1 text-ink-2">Last updated {updated}. Questions? {BRAND.supportEmail}</p>

      <nav className="mt-6 flex flex-wrap gap-2">
        <a href="#terms" className="chip-soft">Terms</a>
        <a href="#privacy" className="chip-soft">Privacy</a>
        <a href="#refund" className="chip-soft">Refunds &amp; cancellation</a>
        <a href="#delivery" className="chip-soft">Delivery</a>
        <a href="#contact" className="chip-soft">Contact</a>
      </nav>

      <section id="terms" className="prose-legal mt-8 scroll-mt-20 space-y-3">
        <h2 className="text-xl font-bold">Terms of Service</h2>
        <p className="text-ink-2">
          {BRAND.name} provides a digital loyalty platform for businesses and their customers.
          By creating an account you agree to use the service lawfully and not to abuse rewards,
          stamps, or messaging features. Businesses are responsible for honouring the rewards they
          configure and for the accuracy of their listing, menu and offers.
        </p>
        <p className="text-ink-2">
          The customer app is free. Business subscriptions are billed annually per the plan selected
          (Basic {`₹${TIERS.basic.price}`}, Growth {`₹${TIERS.growth.price}`}, Pro {`₹${TIERS.pro.price}`}).
          All prices shown are inclusive of GST at 18%; a tax invoice is issued automatically on payment and is available from your dashboard. We may suspend accounts that violate these terms or applicable law.
        </p>
      </section>

      <section id="privacy" className="mt-8 scroll-mt-20 space-y-3">
        <h2 className="text-xl font-bold">Privacy Policy</h2>
        <p className="text-ink-2">
          We collect the minimum needed to run the service: your mobile number (for sign-in), your
          name (optional), and — for businesses — your shop details. Loyalty activity (stamps, rewards,
          scratch cards) is stored to power your account. Businesses can see the name and phone number
          of customers who collect stamps at their shop, used only to run their loyalty programme and
          send opt-in updates.
        </p>
        <p className="text-ink-2">
          We use processors including Supabase (database/auth), Razorpay (payments), an SMS provider
          (OTP) and, where enabled, WhatsApp for business messaging. We do not sell personal data.
          You may request deletion of your account and data at {BRAND.supportEmail}.
        </p>
      </section>

      <section id="refund" className="mt-8 scroll-mt-20 space-y-3">
        <h2 className="text-xl font-bold">Refund &amp; Cancellation Policy</h2>
        <p className="text-ink-2">
          Every business plan starts with a free trial and requires no payment to begin. You can cancel
          your subscription at any time from your dashboard; cancellation stops future renewals and your
          plan remains active until the end of the current paid period.
        </p>
        <p className="text-ink-2">
          If you were charged in error or are unsatisfied, contact {BRAND.supportEmail} within 7 days of
          a charge for a full refund of that billing period. Refunds are processed to the original payment
          method via Razorpay within 5–7 business days.
        </p>
      </section>

      <section id="delivery" className="mt-8 scroll-mt-20 space-y-3">
        <h2 className="text-xl font-bold">Delivery Policy</h2>
        <p className="text-ink-2">
          {BRAND.name} is a digital service. There is nothing to ship. Access to your plan is
          activated on your account immediately after a successful payment is confirmed, and is
          available from your dashboard straight away.
        </p>
        <p className="text-ink-2">
          Where a plan includes a physical QR stand, it is dispatched within 7 working days of
          activation to the address on your account, at no additional cost. Your loyalty programme
          works from your own printed QR in the meantime — the stand is a convenience, not a
          requirement.
        </p>
      </section>

      <section id="contact" className="mt-8 scroll-mt-20 space-y-3">
        <h2 className="text-xl font-bold">Contact Us</h2>
        <div className="card mt-2 space-y-1.5 text-ink-2">
          <div><span className="label">Operated by</span><div className="font-semibold text-ink">{BRAND.legalEntity}</div></div>
          <div><span className="label">Address</span><div className="font-semibold text-ink">{BRAND.address}</div></div>
          <div><span className="label">Email</span><div className="font-semibold text-ink">{BRAND.supportEmail}</div></div>
          <div><span className="label">Phone</span><div className="font-semibold text-ink">{BRAND.supportPhone}</div></div>
        </div>
        <p className="text-sm">We reply to support requests within one working day.</p>
      </section>
    </main>
  );
}
