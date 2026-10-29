-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0007 shop profile extras
-- Social links and opening hours for the public shop page.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.restaurants
  add column if not exists social_links jsonb not null default '{}'::jsonb,   -- {instagram, facebook, whatsapp, website}
  add column if not exists hours        jsonb not null default '{}'::jsonb;    -- {mon:"9-6", ...} free-form
