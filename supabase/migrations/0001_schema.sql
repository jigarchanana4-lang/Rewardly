-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0001 schema
-- Core tables for a QR loyalty platform (stamp cards, scratch cards, menu).
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── enums ──────────────────────────────────────────────────────────────
do $$ begin
  create type user_role   as enum ('customer', 'owner', 'admin');
  create type scan_status as enum ('pending', 'approved', 'declined');
  create type reward_status as enum ('pending', 'redeemed', 'expired');
  create type sub_tier    as enum ('basic', 'growth', 'pro');
  create type sub_status  as enum ('trial', 'active', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

-- ─── profiles (1:1 with auth.users) ─────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  phone_number  text,
  email         text,
  avatar_url    text,
  has_restaurant boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  role        user_role not null default 'customer',
  role_locked boolean not null default false
);

-- ─── restaurants (a "business") ─────────────────────────────────────────
create table if not exists public.restaurants (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  name               text not null,
  slug               text not null unique,
  description        text,
  category           text,                       -- cafe|restaurant|salon|gym|...
  logo_url           text,
  cover_url          text,
  phone              text,
  address            text,
  lat                double precision,
  lng                double precision,
  stamps_required    int  not null default 10 check (stamps_required between 1 and 30),
  reward_title       text default 'Free reward',
  reward_description text,
  reward_image_url   text,
  google_review_url  text,
  google_review_text text,
  stamp_card_enabled boolean not null default true,
  scratch_enabled    boolean not null default false,
  scratch_prizes     jsonb   not null default '[]'::jsonb,  -- [{label, weight}]
  is_active          boolean not null default true,
  total_visits       int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists restaurants_owner_idx on public.restaurants(owner_id);
create index if not exists restaurants_active_idx on public.restaurants(is_active);

create table if not exists public.branches (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  address       text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now()
);
create index if not exists branches_restaurant_idx on public.branches(restaurant_id);

-- ─── loyalty cards (one per customer × restaurant) ──────────────────────
create table if not exists public.loyalty_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  branch_id      uuid references public.branches(id) on delete set null,
  current_stamps int not null default 0,
  total_visits   int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, restaurant_id)
);
create index if not exists loyalty_cards_user_idx on public.loyalty_cards(user_id);
create index if not exists loyalty_cards_restaurant_idx on public.loyalty_cards(restaurant_id);

-- ─── scan events (owner-approved stamping; idempotency lives here) ───────
create table if not exists public.scan_events (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  status        scan_status not null default 'pending',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id)
);
create index if not exists scan_events_restaurant_status_idx on public.scan_events(restaurant_id, status);
create index if not exists scan_events_customer_idx on public.scan_events(customer_id);

-- ─── claimed rewards ────────────────────────────────────────────────────
create table if not exists public.claimed_rewards (
  id                uuid primary key default gen_random_uuid(),
  loyalty_card_id   uuid references public.loyalty_cards(id) on delete set null,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  reward_title      text not null,
  reward_description text,
  reward_image_url  text,
  status            reward_status not null default 'pending',
  code              text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  expires_at        timestamptz not null default (now() + interval '30 days'),
  created_at        timestamptz not null default now(),
  redeemed_at       timestamptz
);
create index if not exists claimed_rewards_user_idx on public.claimed_rewards(user_id);
create index if not exists claimed_rewards_restaurant_idx on public.claimed_rewards(restaurant_id);

-- ─── scratch cards ──────────────────────────────────────────────────────
create table if not exists public.scratch_card_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  prize         text not null,
  is_claimed    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists scratch_user_idx on public.scratch_card_results(user_id);

-- ─── digital menu ───────────────────────────────────────────────────────
create table if not exists public.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id   uuid references public.menu_categories(id) on delete set null,
  name          text not null,
  description   text,
  price         numeric(10,2),
  image_url     text,
  is_available  boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists menu_items_restaurant_idx on public.menu_items(restaurant_id);

-- ─── subscriptions (one per restaurant) ─────────────────────────────────
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  restaurant_id            uuid not null unique references public.restaurants(id) on delete cascade,
  tier                     sub_tier not null default 'basic',
  status                   sub_status not null default 'trial',
  razorpay_subscription_id text,
  razorpay_payment_id      text,
  trial_end                timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ─── misc ───────────────────────────────────────────────────────────────
create table if not exists public.hero_banners (
  id         uuid primary key default gen_random_uuid(),
  image_url  text,
  title      text,
  subtitle   text,
  link_url   text,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.web_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text,
  auth       text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ─── updated_at trigger ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_restaurants_updated on public.restaurants;
create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function public.set_updated_at();
drop trigger if exists trg_cards_updated on public.loyalty_cards;
create trigger trg_cards_updated before update on public.loyalty_cards
  for each row execute function public.set_updated_at();
drop trigger if exists trg_subs_updated on public.subscriptions;
create trigger trg_subs_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── auto-create profile + role on signup ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone_number, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
