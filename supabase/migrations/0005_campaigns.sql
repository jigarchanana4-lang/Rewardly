-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0005 WhatsApp campaigns
-- Owner-side re-engagement broadcasts. Rows are written by the trusted send
-- route (service role); owners can read their own campaign history.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  body          text not null,
  audience      text not null default 'all',   -- all | near_reward | inactive
  status        text not null default 'sent',  -- draft | sent
  recipients    int not null default 0,
  sent          int not null default 0,
  failed        int not null default 0,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists campaigns_restaurant_idx on public.campaigns(restaurant_id);

alter table public.campaigns enable row level security;
create policy "campaigns owner read" on public.campaigns for select
  using (public.owns_restaurant(restaurant_id));
