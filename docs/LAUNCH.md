# Hospiminds launch plan

Decided 2026-08-17. This file is the source of truth; the conversation is not.

## Product line

Six products under the Hospiminds brand.

**Naming: Rewardly keeps its own name** (decided 2026-08-17 — Jigar likes it, and
it is the only product with a consumer-facing surface). It is "Rewardly by
Hospiminds". The other five are descriptive under Hospiminds — fewer brands,
more brand.

| Product | Was called | Tier | Ships on |
|---|---|---|---|
| **Rewardly** | — (name kept) | Hero | this repo — own DB |
| **Hospiminds Menu** | Smart Menu | Hero | this repo — already built |
| **Hospiminds Reviews** | Review Radar | Hero | hospiminds app — blocked on DB |
| **Hospiminds Studio** | Yummy CAM | Mini | new build, standalone |
| **Hospiminds Review QR** | Feedback IQ | Mini — free tier of Reviews | minimal |
| **Hospiminds Reservations** | WhatsApp Reservation Agent | Hero #4, post-launch | gated on Meta |

## Two surfaces, one deliberate threshold

- `hospiminds.com` — who we are. Spice palette, **untouched**.
- `app.hospiminds.com` — what we build. Products + AI consultancy, Rewardly's
  design system.

The visual jump is **intentional**, not a mistake to hide: it marks entering the
AI side. It only reads that way if it is *marked* —
1. foreshadow it on `www` with a section in the app's palette before the click,
2. CTA copy that names the destination,
3. `app.hospiminds.com/home` does the welcoming.

**Never put a page in the way.** The threshold is the destination, never an
extra click; an interstitial trades conversion for an aesthetic point.

## Architecture

**Multi-zone.** Loyalty deploys as its own Vercel project; `app.hospiminds.com`
rewrites `/loyalty/*` to it. One domain to the customer, independent deploys
underneath — this is what decouples the launch from the dead Hospiminds
database. See `DEPLOY.md` §4.

Design: **one system, per-product accent, product-specific layouts.** Loyalty
ultraviolet · Menu mango · Reviews cobalt · Studio bubblegum. Not six design
systems — that is N× the maintenance forever and breaks the suite upsell.

## Tracks

### A — Ship something that takes money (critical path)
- [x] A0 Legal pages: terms, privacy, refunds, **delivery**, **contact**
- [x] A0 `.env.production.example`, `DEPLOY.md`
- [ ] A1 Supabase project + migrations `0001`–`0012`
- [ ] A1 Razorpay live account, plans, webhook
- [ ] A1 SMS provider for OTP (+ rate limit)
- [ ] A1 Vercel deploy + `/loyalty` rewrite
- [ ] A1 **Live ₹1 smoke test** — see `DEPLOY.md` §5
- [ ] A2 Menu + free Menu QR — packaging, same infra

### B — Restore and unify the app
- [ ] B1 New Supabase for `hospiminds` + 14 migrations + env + **redeploy**
- [ ] B1 Fix the dead GitHub token on that remote; commit the stray `toolkit` work
- [ ] B2 Design port — measured: **~85% of colour usage is token-driven**
      (1,333 Tailwind classes + 91 `var()` refs vs 261 hardcoded hex in 23 of
      152 files). Tailwind v4 `@theme` swap, **alias the spice names to the new
      values** rather than renaming 1,333 usages. Then clean up the 23 files.
- [ ] B3 Reviews, **CSV-first** — ingestion today is CSV/manual, not live Google

### C — Site and story
- [ ] C1 Marketing site: 16 products → 6
- [ ] C2 **Rebuild the price ladder** — a ₹999/yr product cannot sit on a page
      anchored at ₹4,999/mo without explanation
- [ ] C3 The threshold: preview section, CTA colour + copy, `/home` as doorway
- [ ] C4 Wire the existing health-check + hygiene-scorer lead magnets into the funnel

### Running underneath — start now, clocks are not ours
- [ ] Meta WhatsApp Business verification → gates Reservations
- [ ] Google Business Profile API → gates live review sync

## Launch scope

Position all six. Make **Loyalty and Menu** the only two purchasable on day one;
the rest waitlisted with honest dates. Two products that work plus a credible
roadmap beats six that half-work.

## Open decisions

- **Does "Rewardly" survive as a name?** Everything now sits under Hospiminds,
  so `Hospiminds Loyalty` is the consistent choice. Renaming is one edit to
  `src/config/brand.ts` and costs nothing today; after QR stands, customers and
  a Razorpay account exist in that name, it is expensive. **Not yet actioned.**
- Consultancy content lives on the app domain. Coherent under the "AI side"
  framing — just be deliberate about it.

## Guardrails agreed

- **Studio enhances the real photo, never regenerates the dish** — a burger that
  doesn't match what arrives is a consumer complaint and a Swiggy/Zomato problem
  for your customer.
- **Review QR is never marketed as "show it to happy customers."** Selective
  solicitation is review gating; Google prohibits it and penalises listings. The
  product is fine — the marketing sentence is the risk. Sell it as "one scan, no
  typing."
- **Bespoke frontends consume the same backend.** Never fork the app, or every
  security fix must be applied N times by hand.
- **Retainers cover hosting, support and platform updates. Design changes are
  billed change requests.** Decide this before the first client.
