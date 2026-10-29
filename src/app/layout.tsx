import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";
import RefCapture from "@/components/RefCapture";
import SWRegister from "@/components/SWRegister";

/** Display — quirky terminals, real character. Headlines and big numerals. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

/** Body — friendly geometric grotesque that stays professional at 14px. */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

/** Utility — labels, reward codes, anything that should read as machine output. */
const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "Collect digital stamps at cafés, salons, gyms and more. Earn free rewards with every visit. Free for customers.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: { siteName: BRAND.name, type: "website", locale: "en_IN" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: BRAND.colors.brand,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div className="grain" aria-hidden />
        <div className="relative z-10">
          <RefCapture />
          <SWRegister />
          {children}
        </div>
      </body>
    </html>
  );
}
