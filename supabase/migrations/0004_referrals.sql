-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0004 referral loop
-- Every customer gets a referral code. When a friend signs up via the link
-- and earns their FIRST stamp anywhere, the referrer receives a bonus stamp
-- at that same shop. Both sides benefit; it rides the existing stamp flow.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists referral_code text unique;

create or replace function public.gen_referral_code()
returns text language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- backfill any existing profiles
update public.profiles set referral_code = public.gen_referral_code()
where referral_code is null;

-- regenerate the signup handler to also mint a referral code
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := public.gen_referral_code();
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;

  insert into public.profiles (id, phone_number, email, referral_code)
  values (new.id, new.phone, new.email, v_code)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;
  return new;
end $$;

-- ─── referrals table ────────────────────────────────────────────────────
create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id  uuid not null unique references public.profiles(id) on delete cascade,
  status      text not null default 'pending',  -- pending | rewarded
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);

alter table public.referrals enable row level security;
create policy "referrals read own" on public.referrals for select
  using (referrer_id = auth.uid() or referee_id = auth.uid());

-- ─── internal: award one stamp (reused by scan + referral bonus) ─────────
create or replace function public._award_stamp(p_user uuid, p_restaurant uuid, p_branch uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_rest public.restaurants; v_card public.loyalty_cards; v_reward uuid; v_new int;
begin
  select * into v_rest from public.restaurants where id = p_restaurant;

  insert into public.loyalty_cards (user_id, restaurant_id, branch_id, current_stamps, total_visits)
  values (p_user, p_restaurant, p_branch, 1, 1)
  on conflict (user_id, restaurant_id) do update
    set current_stamps = public.loyalty_cards.current_stamps + 1,
        total_visits   = public.loyalty_cards.total_visits + 1,
        branch_id      = coalesce(excluded.branch_id, public.loyalty_cards.branch_id)
  returning * into v_card;

  update public.restaurants set total_visits = total_visits + 1 where id = p_restaurant;
  v_new := v_card.current_stamps;

  if v_new >= v_rest.stamps_required then
    insert into public.claimed_rewards
      (loyalty_card_id, user_id, restaurant_id, reward_title, reward_description, reward_image_url)
    values (v_card.id, p_user, v_rest.id,
            coalesce(v_rest.reward_title,'Free reward'), v_rest.reward_description, v_rest.reward_image_url)
    returning id into v_reward;
    update public.loyalty_cards set current_stamps = 0 where id = v_card.id;
  end if;

  return v_reward;
end $$;

-- ─── record a referral at signup ────────────────────────────────────────
create or replace function public.record_referral(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_ref uuid;
begin
  if v_me is null then raise exception 'auth required'; end if;
  select id into v_ref from public.profiles where referral_code = upper(p_code);
  if v_ref is null or v_ref = v_me then return; end if;            -- invalid / self-referral
  if exists (select 1 from public.referrals where referee_id = v_me) then return; end if;  -- one per user
  insert into public.referrals (referrer_id, referee_id) values (v_ref, v_me)
  on conflict (referee_id) do nothing;
end $$;

grant execute on function public.record_referral(text) to authenticated;

-- ─── approve_scan: award referee's stamp, then referral bonus (once) ─────
create or replace function public.approve_scan(p_scan_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_scan public.scan_events;
  v_rest public.restaurants;
  v_reward uuid;
  v_referrer uuid;
  v_card public.loyalty_cards;
begin
  select * into v_scan from public.scan_events where id = p_scan_id for update;
  if not found then raise exception 'scan not found'; end if;
  if not public.owns_restaurant(v_scan.restaurant_id) then raise exception 'not authorized'; end if;
  if v_scan.status <> 'pending' then
    return jsonb_build_object('already_resolved', true, 'status', v_scan.status);
  end if;

  select * into v_rest from public.restaurants where id = v_scan.restaurant_id;

  -- award the customer's stamp
  v_reward := public._award_stamp(v_scan.customer_id, v_scan.restaurant_id, v_scan.branch_id);

  -- referral bonus: once, when this referee has a pending referral
  select referrer_id into v_referrer
    from public.referrals where referee_id = v_scan.customer_id and status = 'pending' limit 1;
  if v_referrer is not null then
    update public.referrals set status = 'rewarded', rewarded_at = now()
     where referee_id = v_scan.customer_id and status = 'pending';
    perform public._award_stamp(v_referrer, v_scan.restaurant_id, null);
  end if;

  update public.scan_events
     set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
   where id = p_scan_id;

  select * into v_card from public.loyalty_cards
   where user_id = v_scan.customer_id and restaurant_id = v_scan.restaurant_id;

  return jsonb_build_object(
    'already_resolved', false,
    'current_stamps', coalesce(v_card.current_stamps, 0),
    'stamps_required', v_rest.stamps_required,
    'reward_id', v_reward,
    'referral_rewarded', v_referrer is not null
  );
end $$;
