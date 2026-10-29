# Go-live runbook

Order matters. Several steps fail silently if done out of sequence — those are
called out inline.

Nothing here is done yet. Everything currently runs against a local Supabase on
one laptop, with every paid integration stubbed behind `DEV_MODE=true`.

---

## 1. Supabase project

Create a **new** project. Do not reuse the Hospiminds one — `pdcyfanycdgkgagoqlhs`
returns NXDOMAIN; that project no longer exists.

Apply migrations **in numeric order**, `0001` → `0012`:

```bash
supabase link --project-ref <ref>
supabase db push
```

Or paste each file into the SQL editor in order. Do not skip or reorder:

| | |
|---|---|
| `0001` | schema |
| `0002` | RPCs + RLS — the security seam. No client writes loyalty state. |
| `0003` | storage bucket |
| `0004` | referrals |
| `0005` | campaigns |
| `0006` | billing |
| `0007` | profile extras |
| `0008` | points mode |
| **`0009`** | **grants — without this every REST call fails `42501 permission denied`, even with correct RLS** |
| `0010` | auto-approve / fast mode |
| `0011` | `shop_plan()` — without this every public shop page shows "not stamping right now" |
| `0012` | per-shop branding + white-label |

**Verify before moving on** — anon REST must return `200`, not `401`/`42501`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<ref>.supabase.co/rest/v1/restaurants?select=id&limit=1" \
  -H "apikey: <anon-key>"
```

### Phone auth

Auth → Providers → **Phone**: enable, connect a real SMS provider.

Two things to get right:
- **Remove the test OTP numbers.** `supabase/config.toml` hardcodes `123456` for
  four numbers. That is local-only, but confirm none carried over.
- **Set a rate limit.** Each SMS costs money. Without a cap, a scripted signup
  loop runs up a bill overnight.

---

## 2. Razorpay

Razorpay reviews your site before approving live keys. It checks for five
publicly reachable policies. All five are on `/legal`:
terms · privacy · refunds · **delivery** · **contact**.

**Fill in the real business identity first** — `src/config/brand.ts` →
`legalEntity`, `address`, `supportPhone`, `supportEmail`. Placeholder values
will fail review.

Then:
1. Create three **subscription plans** matching `TIERS` in `src/config/brand.ts`.
   If the amounts drift, customers are charged the wrong price.
2. Copy the plan IDs into `RAZORPAY_PLAN_*`.
3. Add a webhook → `https://<your-domain>/api/razorpay/webhook`, subscribe to
   subscription events, and copy the signing secret into
   `RAZORPAY_WEBHOOK_SECRET`. A wrong secret rejects every webhook silently, so
   payments succeed but plans never activate.

---

## 3. Vercel

Import the repo, then set every variable from `.env.production.example` at
**Production** scope.

> **`NEXT_PUBLIC_*` are inlined at build time.** Changing one and saving does
> nothing to the running site. You must **redeploy**. This is the single most
> common go-live mistake and it is invisible — the old value keeps working.

---

## 4. Multi-zone routing (serving under app.hospiminds.com)

Loyalty deploys as its own Vercel project and is served from a path on the
Hospiminds app. One domain and one brand to the customer; independent deploys
underneath — which is what lets Loyalty ship without waiting on the Hospiminds
database restore.

**In the Rewardly project** — `next.config.mjs`:

```js
const nextConfig = {
  basePath: "/loyalty",
  assetPrefix: "/loyalty",
};
```

**In the `hospiminds` app** — `next.config.js`:

```js
async rewrites() {
  return [
    { source: "/loyalty",      destination: `${process.env.LOYALTY_ZONE_URL}/loyalty` },
    { source: "/loyalty/:path*", destination: `${process.env.LOYALTY_ZONE_URL}/loyalty/:path*` },
  ];
}
```

Set `LOYALTY_ZONE_URL` to the Rewardly deployment's URL.

**Set `NEXT_PUBLIC_SITE_URL` to the public path** (`https://app.hospiminds.com/loyalty`),
never the raw `*.vercel.app` URL. QR codes are generated from this value, and a
printed QR is effectively permanent.

---

## 5. Smoke test — with real money

Test mode does not prove this works. Run the whole path on production:

- [ ] Sign up as a business with a real phone → OTP actually arrives
- [ ] Complete onboarding → shop created
- [ ] Pay for a plan with a real card → **charge a ₹1 plan if you can**
- [ ] Webhook lands → subscription shows active in the dashboard
- [ ] Public shop page loads and does **not** say "not stamping right now"
      (if it does: migration `0011` did not run)
- [ ] Scan the QR on a second phone, sign up as a customer, collect a stamp
- [ ] Owner approves it in the live queue → stamp appears
- [ ] Complete a card → reward issued with a code → redeem it
- [ ] Set brand colours in Settings → shop page re-tints
- [ ] Upload a menu photo → items extracted → save → they appear publicly

**Done when a stranger can sign up, pay, and stamp a customer.** Until every box
is ticked on production, this is not launched.

---

## 6. After launch

- Revoke the Supabase service-role key if it was ever pasted anywhere shared
- Turn on Supabase daily backups
- Point `SENTRY_DSN` at a real project so errors surface
- Start the Meta WhatsApp and Google Business Profile applications if not already
  running — both gate later products and neither clock is yours
