-- 0016 — credits for model-powered features.
--
-- Image and video models cost real money per call. Unlimited use on a ₹999/yr
-- plan loses money on the customers who use it most, so metered features are
-- paid for in credits.
--
-- Design rule that keeps this honest: **anything that costs us nothing stays
-- free and unlimited.** The local canvas enhancement in lib/photo.ts runs on
-- the owner's device and never spends a credit. Credits gate only the
-- operations that actually bill us.

alter table public.restaurants
  add column if not exists credits integer not null default 0;

alter table public.restaurants
  drop constraint if exists restaurants_credits_non_negative;
alter table public.restaurants
  add constraint restaurants_credits_non_negative check (credits >= 0);

create table if not exists public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  -- Signed: negative spends, positive grants/top-ups/refunds.
  amount        integer not null,
  balance_after integer not null,
  kind          text not null check (kind in ('grant','topup','spend','refund','expire','adjust')),
  -- What it was spent on, e.g. 'photo.relight'. Null for grants.
  operation     text,
  -- Idempotency: a retried request must not double-spend.
  request_id    text unique,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists credit_ledger_idx
  on public.credit_ledger(restaurant_id, created_at desc);

alter table public.credit_ledger enable row level security;

-- Owners read their own ledger. Nobody writes from the client — balances move
-- only through the functions below.
create policy "credit ledger owner read" on public.credit_ledger
  for select using (public.owns_restaurant(restaurant_id));

/**
 * Spend credits atomically.
 *
 * Takes a row lock so two concurrent requests cannot both spend the last
 * credit, and is idempotent on p_request_id so a retry (or a double-tapped
 * button) charges once. Returns the new balance, or raises if there aren't
 * enough — callers must treat the raise as "show a top-up prompt", never as a
 * reason to run the operation anyway.
 */
create or replace function public.spend_credits(
  p_restaurant_id uuid,
  p_amount        integer,
  p_operation     text,
  p_request_id    text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_existing integer;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  -- Already charged for this request? Return the balance we recorded then.
  select balance_after into v_existing
  from public.credit_ledger where request_id = p_request_id;
  if found then return v_existing; end if;

  select credits into v_balance
  from public.restaurants where id = p_restaurant_id
  for update;                       -- serialise concurrent spends
  if not found then raise exception 'restaurant not found'; end if;

  if v_balance < p_amount then
    raise exception 'insufficient credits' using errcode = 'P0002';
  end if;

  v_balance := v_balance - p_amount;
  update public.restaurants set credits = v_balance where id = p_restaurant_id;

  insert into public.credit_ledger (restaurant_id, amount, balance_after, kind, operation, request_id)
  values (p_restaurant_id, -p_amount, v_balance, 'spend', p_operation, p_request_id);

  return v_balance;
end $$;

/** Add credits — a plan grant, a paid top-up, or a refund when a job fails. */
create or replace function public.add_credits(
  p_restaurant_id uuid,
  p_amount        integer,
  p_kind          text,
  p_request_id    text default null,
  p_note          text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_existing integer;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_kind not in ('grant','topup','refund','adjust') then raise exception 'bad kind'; end if;

  if p_request_id is not null then
    select balance_after into v_existing
    from public.credit_ledger where request_id = p_request_id;
    if found then return v_existing; end if;
  end if;

  select credits into v_balance from public.restaurants where id = p_restaurant_id for update;
  if not found then raise exception 'restaurant not found'; end if;

  v_balance := v_balance + p_amount;
  update public.restaurants set credits = v_balance where id = p_restaurant_id;

  insert into public.credit_ledger (restaurant_id, amount, balance_after, kind, request_id, note)
  values (p_restaurant_id, p_amount, v_balance, p_kind, p_request_id, p_note);

  return v_balance;
end $$;

-- Balance changes are server-side only; the client never calls these directly.
revoke execute on function public.spend_credits(uuid, integer, text, text) from anon, authenticated;
revoke execute on function public.add_credits(uuid, integer, text, text, text) from anon, authenticated;
