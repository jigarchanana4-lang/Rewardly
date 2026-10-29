-- 0012 — per-shop brand theming.
--
-- Shops keep their own colours on their public page and loyalty card. Stored as
-- 6-digit hex ("#RRGGBB"); the app converts to the RGB-channel form the design
-- tokens use. NULL means "use the Rewardly palette".
--
-- Deliberately NOT applied to the marketplace (home/explore) — that surface
-- stays Rewardly-branded so the consumer network reads as one product.

alter table public.restaurants
  add column if not exists brand_color  text,
  add column if not exists accent_color text,
  -- Tier A white-label: drop Rewardly chrome from this shop's public page.
  -- Gated to paid plans in the UI; the column itself stays simple.
  add column if not exists white_label  boolean not null default false;

alter table public.restaurants
  drop constraint if exists restaurants_brand_color_hex;
alter table public.restaurants
  add constraint restaurants_brand_color_hex
  check (brand_color is null or brand_color ~* '^#[0-9a-f]{6}$');

alter table public.restaurants
  drop constraint if exists restaurants_accent_color_hex;
alter table public.restaurants
  add constraint restaurants_accent_color_hex
  check (accent_color is null or accent_color ~* '^#[0-9a-f]{6}$');
