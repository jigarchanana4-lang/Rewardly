// Hand-written domain types. Regenerate a full set later with:
//   supabase gen types typescript --linked > src/lib/database.types.ts

export type UserRole = "customer" | "owner" | "admin";
export type ScanStatus = "pending" | "approved" | "declined";
export type RewardStatus = "pending" | "redeemed" | "expired";
export type SubTier = "basic" | "growth" | "pro";
export type SubStatus = "trial" | "active" | "expired" | "cancelled";

export interface Profile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  avatar_url: string | null;
  has_restaurant: boolean;
  referral_code: string | null;
  marketing_opt_in: boolean;
  created_at: string;
}

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  stamps_required: number;
  reward_title: string | null;
  reward_description: string | null;
  reward_image_url: string | null;
  google_review_url: string | null;
  google_review_text: string | null;
  stamp_card_enabled: boolean;
  auto_approve: boolean;
  reward_mode: "stamps" | "points";
  points_per_rupee: number;
  points_threshold: number;
  scratch_enabled: boolean;
  scratch_prizes: { label: string; weight: number }[];
  is_active: boolean;
  total_visits: number;
  social_links: { instagram?: string; facebook?: string; whatsapp?: string; website?: string };
  hours: Record<string, string>;
  /** Tier A theming — 6-digit hex, or null to use the Rewardly palette. */
  brand_color: string | null;
  accent_color: string | null;
  /** Tier A white-label — hides Rewardly chrome on this shop's public page. */
  white_label: boolean;
  /** Feedback IQ — the free Google-review QR. */
  review_qr_enabled: boolean;
  /** Balance for model-powered features. Local work never spends these. */
  credits: number;
  /** GST invoicing. billing_state decides CGST+SGST vs IGST. */
  gstin: string | null;
  billing_state: string | null;
  billing_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  restaurant_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface LoyaltyCard {
  id: string;
  user_id: string;
  restaurant_id: string;
  branch_id: string | null;
  current_stamps: number;
  current_points: number;
  total_visits: number;
  created_at: string;
  updated_at: string;
}

export interface ScanEvent {
  id: string;
  restaurant_id: string;
  customer_id: string;
  branch_id: string | null;
  status: ScanStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ClaimedReward {
  id: string;
  loyalty_card_id: string | null;
  user_id: string;
  restaurant_id: string;
  reward_title: string;
  reward_description: string | null;
  reward_image_url: string | null;
  status: RewardStatus;
  code: string;
  expires_at: string;
  created_at: string;
  redeemed_at: string | null;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  tier: SubTier;
  status: SubStatus;
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
  trial_end: string | null;
  current_period_end: string | null;
}

export interface Invoice {
  id: string;
  restaurant_id: string;
  number: string;
  financial_year: string;
  seq: number;
  issued_at: string;
  tier: string | null;
  razorpay_payment_id: string | null;
  /** All money in paise — integers, so no float drift. */
  total_paise: number;
  taxable_paise: number;
  tax_paise: number;
  gst_rate: number;
  is_interstate: boolean;
  supplier_name: string;
  supplier_gstin: string | null;
  supplier_state: string | null;
  buyer_name: string;
  buyer_gstin: string | null;
  buyer_state: string | null;
  buyer_address: string | null;
  sac_code: string;
}
