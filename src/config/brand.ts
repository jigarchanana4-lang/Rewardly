/**
 * Single source of truth for product identity.
 * Rename here to re-skin the entire app.
 */
export const BRAND = {
  name: "Rewardly",
  tagline: "Earn free rewards at local shops",
  ownerTagline: "Grow your business with loyalty",
  supportEmail: "support@rewardly.example",
  // ⚠️ Razorpay requires a real, publicly visible business identity before it
  // will approve a live account. Fill these in before going live.
  supportPhone: "+91 00000 00000",
  legalEntity: "Hospiminds",
  address: "Add your registered business address",
  // Credits pay for model-powered features (photo studio, later video).
  // Local, on-device work is always free — credits gate only what bills us.
  credits: {
    /** Granted on each paid renewal, per tier. */
    grantByTier: { basic: 20, growth: 60, pro: 150 } as Record<string, number>,
    /** Given once when a trial starts, so the feature can be tried before paying. */
    trialGrant: 10,
    /** Top-up packs, price in rupees (GST-inclusive, like every other price). */
    packs: [
      { id: "small", credits: 50, price: 299 },
      { id: "medium", credits: 150, price: 749 },
      { id: "large", credits: 500, price: 1999 },
    ],
  },
  // GST invoicing. `state` decides CGST+SGST (intra-state) vs IGST (inter-state),
  // so it must be your real place of supply.
  gst: {
    gstin: "",                 // your 15-char GSTIN; blank prints an unregistered invoice
    state: "Maharashtra",
    invoicePrefix: "RW",
  },
  // Colors are also mirrored as CSS variables in globals.css.
  // "Punch Card Arcade" — ultraviolet + acid lime on violet-biased paper.
  colors: {
    brand: "#4B21F5", // ultraviolet
    accent: "#D9FF3D", // zest lime — reward / "you won"
    ink: "#14093B",
    paper: "#F4F1FF",
  },
} as const;

export type TierId = "basic" | "growth" | "pro";

export interface Tier {
  id: TierId;
  name: string;
  price: number; // INR / year
  anchor: number; // struck-through "regular" price
  maxLocations: number;
  gpsBranch: boolean;
  highlights: string[];
  razorpayPlanEnv: string; // env var holding the Razorpay plan id
}

export const TIERS: Record<TierId, Tier> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 999,
    anchor: 1299,
    maxLocations: 1,
    gpsBranch: false,
    highlights: [
      "Digital stamp card",
      "Scratch card gifts",
      "Digital menu / catalog",
      "Free QR stand shipped",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_BASIC",
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 2499,
    anchor: 4999,
    maxLocations: 3,
    gpsBranch: true,
    highlights: [
      "Everything in Basic",
      "Up to 3 locations",
      "One QR, GPS branch auto-detect",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_GROWTH",
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 4999,
    anchor: 9999,
    maxLocations: 6,
    gpsBranch: true,
    highlights: [
      "Everything in Growth",
      "Up to 6 locations",
      "Priority support",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
  },
};

export const TRIAL_DAYS = 3;
export const DEFAULT_STAMPS_REQUIRED = 10;
