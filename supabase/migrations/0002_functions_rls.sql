-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0002 privileged functions, RLS, realtime
-- The loyalty economy (stamps/rewards/scratch) is mutated ONLY through these
-- SECURITY DEFINER functions with explicit auth checks. Clients cannot write
-- to loyalty_cards / claimed_rewards / scan_events / scratch_card_results.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── helper: does auth.uid() own this restaurant? ───────────────────────
create or replace function public.owns_restaurant(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = auth.uid()
  );
$$;

-- ─── customer creates a pending scan ────────────────────────────────────
-- Collapses rapid re-scans into one pending event (idempotent at the source).
create or replace function public.create_scan(p_restaurant_id uuid, p_branch_id uuid default null)
returns public.scan_events language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_scan public.scan_events;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id and is_active) then
    raise exception 'restaurant not found';
  end if;

  -- reuse an existing pending scan from the last 10 minutes if present
  select * into v_scan from public.scan_events
   where restaurant_id = p_restaurant_id and customer_id = v_uid
     and status = 'pending' and created_at > now() - interval '10 minutes'
   order by created_at desc limit 1;
  if found then return v_scan; end if;

  insert into public.scan_events (restaurant_id, customer_id, branch_id)
  values (p_restaurant_id, v_uid, p_branch_id)
  returning * into v_scan;
  return v_scan;
end $$;

-- ─── owner approves a scan → award a stamp (idempotent) ─────────────────
-- Re-calling on an already-resolved scan returns state without double-stamping.
create or replace function public.approve_scan(p_scan_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_scan   public.scan_events;
  v_rest   public.restaurants;
  v_card   public.loyalty_cards;
  v_reward uuid;
  v_new    int;
begin
  select * into v_scan from public.scan_events where id = p_scan_id for update;
  if not found then raise exception 'scan not found'; end if;
  if not public.owns_restaurant(v_scan.restaurant_id) then raise exception 'not authorized'; end if;

  -- idempotency guard
  if v_scan.status <> 'pending' then
    return jsonb_build_object('already_resolved', true, 'status', v_scan.status);
  end if;

  select * into v_rest from public.restaurants where id = v_scan.restaurant_id;

  insert into public.loyalty_cards (user_id, restaurant_id, branch_id, current_stamps, total_visits)
  values (v_scan.customer_id, v_scan.restaurant_id, v_scan.branch_id, 1, 1)
  on conflict (user_id, restaurant_id) do update
    set current_stamps = public.loyalty_cards.current_stamps + 1,
        total_visits   = public.loyalty_cards.total_visits + 1,
        branch_id      = coalesce(excluded.branch_id, public.loyalty_cards.branch_id)
  returning * into v_card;

  update public.restaurants set total_visits = total_visits + 1 where id = v_rest.id;

  v_new := v_card.current_stamps;

  -- threshold reached → mint reward, reset the card for the next cycle
  if v_new >= v_rest.stamps_required then
    insert into public.claimed_rewards
      (loyalty_card_id, user_id, restaurant_id, reward_title, reward_description, reward_image_url)
    values (v_card.id, v_scan.customer_id, v_rest.id,
            coalesce(v_rest.reward_title,'Free reward'), v_rest.reward_description, v_rest.reward_image_url)
    returning id into v_reward;

    update public.loyalty_cards set current_stamps = 0 where id = v_card.id;
    v_new := 0;
  end if;

  update public.scan_events
     set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
   where id = p_scan_id;

  return jsonb_build_object(
    'already_resolved', false,
    'current_stamps', v_new,
    'stamps_required', v_rest.stamps_required,
    'reward_id', v_reward
  );
end $$;

create or replace function public.decline_scan(p_scan_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_scan public.scan_events;
begin
  select * into v_scan from public.scan_events where id = p_scan_id for update;
  if not found then raise exception 'scan not found'; end if;
  if not public.owns_restaurant(v_scan.restaurant_id) then raise exception 'not authorized'; end if;
  if v_scan.status = 'pending' then
    update public.scan_events set status='declined', resolved_at=now(), resolved_by=auth.uid()
     where id = p_scan_id;
  end if;
end $$;

-- ─── owner marks a reward redeemed ──────────────────────────────────────
create or replace function public.redeem_reward(p_reward_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_r public.claimed_rewards;
begin
  select * into v_r from public.claimed_rewards where id = p_reward_id for update;
  if not found then raise exception 'reward not found'; end if;
  if not public.owns_restaurant(v_r.restaurant_id) then raise exception 'not authorized'; end if;
  if v_r.status = 'pending' then
    update public.claimed_rewards set status='redeemed', redeemed_at=now() where id = p_reward_id;
  end if;
end $$;

-- ─── scratch card: server-authoritative prize draw ──────────────────────
create or replace function public.reveal_scratch(p_restaurant_id uuid)
returns public.scratch_card_results language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rest public.restaurants;
  v_prizes jsonb;
  v_prize text;
  v_row public.scratch_card_results;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into v_rest from public.restaurants where id = p_restaurant_id and scratch_enabled;
  if not found then raise exception 'scratch not available'; end if;

  -- one unclaimed scratch per customer per restaurant per day
  select * into v_row from public.scratch_card_results
   where user_id = v_uid and restaurant_id = p_restaurant_id
     and created_at::date = now()::date limit 1;
  if found then return v_row; end if;

  v_prizes := v_rest.scratch_prizes;
  if jsonb_array_length(coalesce(v_prizes,'[]'::jsonb)) = 0 then
    v_prize := 'Better luck next time';
  else
    v_prize := (v_prizes -> floor(random()*jsonb_array_length(v_prizes))::int ->> 'label');
  end if;

  insert into public.scratch_card_results (user_id, restaurant_id, prize)
  values (v_uid, p_restaurant_id, coalesce(v_prize,'Better luck next time'))
  returning * into v_row;
  return v_row;
end $$;

-- ─── grants ─────────────────────────────────────────────────────────────
grant execute on function
  public.create_scan(uuid,uuid), public.approve_scan(uuid), public.decline_scan(uuid),
  public.redeem_reward(uuid), public.reveal_scratch(uuid), public.owns_restaurant(uuid)
to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════
alter table public.profiles              enable row level security;
alter table public.user_roles            enable row level security;
alter table public.restaurants           enable row level security;
alter table public.branches              enable row level security;
alter table public.loyalty_cards         enable row level security;
alter table public.scan_events           enable row level security;
alter table public.claimed_rewards       enable row level security;
alter table public.scratch_card_results  enable row level security;
alter table public.menu_categories       enable row level security;
alter table public.menu_items            enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.hero_banners          enable row level security;
alter table public.web_push_subscriptions enable row level security;

-- profiles
create policy "profiles self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid());

-- user_roles (read own)
create policy "roles self read" on public.user_roles for select using (user_id = auth.uid());

-- restaurants: public can read active; owner manages own
create policy "restaurants public read" on public.restaurants for select using (is_active or owner_id = auth.uid());
create policy "restaurants owner insert" on public.restaurants for insert with check (owner_id = auth.uid());
create policy "restaurants owner update" on public.restaurants for update using (owner_id = auth.uid());
create policy "restaurants owner delete" on public.restaurants for delete using (owner_id = auth.uid());

-- branches
create policy "branches public read" on public.branches for select using (true);
create policy "branches owner manage" on public.branches for all
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

-- loyalty_cards: read own (customer) or owner; writes only via functions
create policy "cards read" on public.loyalty_cards for select
  using (user_id = auth.uid() or public.owns_restaurant(restaurant_id));

-- scan_events: read own or owner; writes only via functions
create policy "scans read" on public.scan_events for select
  using (customer_id = auth.uid() or public.owns_restaurant(restaurant_id));

-- claimed_rewards: read own or owner
create policy "rewards read" on public.claimed_rewards for select
  using (user_id = auth.uid() or public.owns_restaurant(restaurant_id));

-- scratch results: read own or owner
create policy "scratch read" on public.scratch_card_results for select
  using (user_id = auth.uid() or public.owns_restaurant(restaurant_id));

-- menu: public read; owner manage
create policy "menu cat read" on public.menu_categories for select using (true);
create policy "menu cat manage" on public.menu_categories for all
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "menu item read" on public.menu_items for select using (true);
create policy "menu item manage" on public.menu_items for all
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

-- subscriptions: owner only
create policy "subs owner read" on public.subscriptions for select using (public.owns_restaurant(restaurant_id));

-- hero banners: public read active
create policy "banners read" on public.hero_banners for select using (is_active);

-- web push: manage own
create policy "push manage" on public.web_push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- Realtime — owner scan feed + customer scratch/rewards
-- ═══════════════════════════════════════════════════════════════════════
do $$ begin
  alter publication supabase_realtime add table public.scan_events;
  alter publication supabase_realtime add table public.loyalty_cards;
  alter publication supabase_realtime add table public.claimed_rewards;
  alter publication supabase_realtime add table public.scratch_card_results;
exception when duplicate_object then null; end $$;
