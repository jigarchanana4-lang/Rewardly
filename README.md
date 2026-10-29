# Rewardly

QR-driven digital loyalty for local businesses — **stamp cards, scratch cards, and a digital menu** in one installable web app. Free for customers; annual subscription for businesses. Built on the reverse-engineered architecture of druto.in, with an original brand and codebase.

- **Customer**: phone-OTP login → scan a shop's QR → owner approves → collect a stamp → earn a reward.
- **Business**: onboard in 2 minutes, get a QR, approve scans in real time, run rewards, sell via a subscription.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind, installable PWA |
| Backend | Supabase (Postgres, Auth, Realtime, RLS) |
| Privileged logic | Postgres `SECURITY DEFINER` functions (stamping/rewards) + Next route handlers (payments) |
| Auth | Supabase phone OTP (wire MSG91/Twilio as the SMS provider) |
| Payments | Razorpay (subscriptions, or one-time annual order fallback) |
| Images | ImageKit / Supabase Storage (menu & logos) |

## Architecture at a glance

The browser can **read** a few tables (RLS-scoped) but can **never write** loyalty state. Every stamp, reward, and scratch outcome is minted by a `SECURITY DEFINER` Postgres function with an explicit `auth.uid()` / owner check. Payments are verified server-side in Next route handlers using the Razorpay secret. This is the key security seam — don't move it into the client.

```
Next.js PWA ──▶ Supabase RLS tables (read: restaurants, menus, own cards/rewards)
            ──▶ RPCs  create_scan · approve_scan · decline_scan · redeem_reward · reveal_scratch
            ──▶ /api/razorpay/*  (create + signature-verify → activate subscription)
            ◀── Realtime  scan_events · loyalty_cards · claimed_rewards · scratch_card_results
```

## Setup

### 1. Install
```bash
npm install
```

### 2. Create a Supabase project
Run the migrations (Supabase SQL editor, or CLI):
```bash
# option A: CLI
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations/*

# option B: paste the migrations into the SQL editor IN ORDER:
#   0001_schema.sql → 0002_functions_rls.sql → 0003_storage.sql
#   → 0004_referrals.sql → 0005_campaigns.sql
```

> `0003_storage.sql` creates a public **`images`** Storage bucket used for logos,
> reward images and menu photos (owners upload only into their own folder).

### 3. Environment
```bash
cp .env.example .env.local   # already present with placeholders
```
Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (Razorpay dashboard → test keys)

### 4. Enable phone login
Supabase → Authentication → Providers → **Phone**. For **free local testing**, add a
*test phone number* with a fixed OTP (no SMS needed). For production, connect
**MSG91** or Twilio as the SMS provider.

### 5. Run
```bash
npm run dev      # http://localhost:3000
```

## Try the core loop
1. Open `/auth`, choose **Business**, sign in, complete onboarding → you land on `/owner`.
2. Copy the QR's URL (or open `/scan/<restaurantId>`), then in a second browser/incognito
   open `/auth` as **Customer**, sign in, open the shop, tap **Collect a stamp**.
3. Back on `/owner`, the scan appears live — tap **Give stamp**. The customer's card
   updates in real time; on the final stamp a reward is minted and shows in `/rewards`.

## What's built

### ✅ Core loyalty loop
- Full schema + RLS + realtime (`supabase/migrations/` 0001–0008)
- Idempotent, owner-approved stamping; reward minting & redemption codes
- **Spend-based points mode** as an alternative to stamps (owner enters bill amount)
- Server-authoritative scratch cards
- Phone-OTP auth with customer/business split
- Customer app: home, explore (+ category filter, SEO metadata), shop page
  (LocalBusiness JSON-LD, stamps **or** points, scratch, menu, hours, socials),
  scan, rewards wallet, profile, push opt-in
- Owner app: onboarding, dashboard (**realtime accept/decline**), analytics,
  settings, menu CRUD, campaigns, billing, QR download

### ✅ Monetization & lifecycle (M1)
- Razorpay checkout + **webhook** (charged/halted/cancelled/failed) + owner cancel
- Trial on signup → **subscription gating** (expiry hides shop, owner banner)
- `/payment-success`, receipt email (Resend; DEV logs), `/legal` (Terms/Privacy/Refund)
- Rate-limiting on sensitive routes; optional Sentry

### ✅ Growth & differentiators
- Referral loop (friend's first stamp → referrer bonus)
- WhatsApp broadcasts (segments, personalised templates, history)
- **Web-push** (customer opt-in + owner push broadcast)
- GPS multi-branch (Growth/Pro): one QR, nearest branch auto-detected
- Owner **analytics** (new/returning, redemption rate, top customers)
- Role-gated **/admin** console (suspend/activate businesses)

### ✅ Platform
- PWA (SVG maskable icons, service worker, offline shell), theme-aware design system
- Dynamic sitemap + robots with AI-bot allow-list (GEO)
- Vitest unit tests + GitHub Actions CI

## Go-live checklist (external — needs your accounts)
These are the only remaining steps; the code is done and config-driven.
1. Razorpay account + KYC → live keys + webhook secret; (optional) create Plan IDs.
2. Meta WhatsApp Business verification + approve a broadcast **template**.
3. SMS provider (MSG91/Twilio) as Supabase phone provider.
4. `RESEND_API_KEY` for real receipts; generate VAPID keys (`npx web-push generate-vapid-keys`).
5. Deploy to Vercel with env vars; run migrations `0001→0008`; set `DEV_MODE=false`.

## Notes
- Make yourself admin: `update user_roles set role='admin' where user_id='<uuid>';`
- Regenerate exact DB types: `supabase gen types typescript --linked > src/lib/database.types.ts`.
- Rename the whole product by editing `src/config/brand.ts`.
