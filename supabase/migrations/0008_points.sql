-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0008 spend-based points (alternative to stamp cards)
-- A shop chooses reward_mode: 'stamps' (default) or 'points'. In points mode
-- the owner enters the bill amount at approval; points = amount × rate.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.restaurants
  add column if not exists reward_mode     text    not null default 'stamps'
    check (reward_mode in ('stamps', 'points')),
  add column if not exists points_per_rupee numeric not null default 1,
  add column if not exists points_threshold int    not null default 100;

alter table public.loyalty_cards
  add column if not exists current_points int not null default 0;

-- Approve a scan in POINTS mode with a bill amount (idempotent, owner-checked).
create or replace function public.approve_scan_points(p_scan_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_scan public.scan_events;
  v_rest public.restaurants;
  v_card public.loyalty_cards;
  v_reward uuid;
  v_pts int;
  v_new int;
begin
  select * into v_scan from public.scan_events where id = p_scan_id for update;
  if not found then raise exception 'scan not found'; end if;
  if not public.owns_restaurant(v_scan.restaurant_id) then raise exception 'not authorized'; end if;
  if v_scan.status <> 'pending' then
    return jsonb_build_object('already_resolved', true, 'status', v_scan.status);
  end if;

  select * into v_rest from public.restaurants where id = v_scan.restaurant_id;
  v_pts := floor(coalesce(p_amount, 0) * coalesce(v_rest.points_per_rupee, 1))::int;

  insert into public.loyalty_cards (user_id, restaurant_id, branch_id, current_points, total_visits)
  values (v_scan.customer_id, v_scan.restaurant_id, v_scan.branch_id, v_pts, 1)
  on conflict (user_id, restaurant_id) do update
    set current_points = public.loyalty_cards.current_points + v_pts,
        total_visits   = public.loyalty_cards.total_visits + 1,
        branch_id      = coalesce(excluded.branch_id, public.loyalty_cards.branch_id)
  returning * into v_card;

  update public.restaurants set total_visits = total_visits + 1 where id = v_rest.id;
  v_new := v_card.current_points;

  if v_rest.points_threshold > 0 and v_new >= v_rest.points_threshold then
    insert into public.claimed_rewards
      (loyalty_card_id, user_id, restaurant_id, reward_title, reward_description, reward_image_url)
    values (v_card.id, v_scan.customer_id, v_rest.id,
            coalesce(v_rest.reward_title,'Free reward'), v_rest.reward_description, v_rest.reward_image_url)
    returning id into v_reward;
    update public.loyalty_cards set current_points = current_points - v_rest.points_threshold where id = v_card.id;
    v_new := v_new - v_rest.points_threshold;
  end if;

  update public.scan_events set status='approved', resolved_at=now(), resolved_by=auth.uid()
   where id = p_scan_id;

  return jsonb_build_object(
    'already_resolved', false, 'points', v_new, 'earned', v_pts,
    'threshold', v_rest.points_threshold, 'reward_id', v_reward
  );
end $$;

grant execute on function public.approve_scan_points(uuid, numeric) to authenticated;
