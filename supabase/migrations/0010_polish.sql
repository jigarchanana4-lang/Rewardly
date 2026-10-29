-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0010 usability polish
-- 1) Fast mode: auto-approve stamps (no owner tap) for busy counters.
-- 2) Marketing opt-out per customer (respected by campaigns + push).
-- ═══════════════════════════════════════════════════════════════════════

alter table public.restaurants
  add column if not exists auto_approve boolean not null default false;

alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default true;

-- create_scan now settles instantly when the shop uses Fast mode (stamps only).
create or replace function public.create_scan(p_restaurant_id uuid, p_branch_id uuid default null)
returns public.scan_events language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rest public.restaurants;
  v_scan public.scan_events;
  v_referrer uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into v_rest from public.restaurants where id = p_restaurant_id and is_active;
  if not found then raise exception 'restaurant not found'; end if;

  -- Fast mode: award the stamp immediately, no pending step.
  if v_rest.auto_approve and v_rest.reward_mode = 'stamps' then
    perform public._award_stamp(v_uid, p_restaurant_id, p_branch_id);

    -- referral bonus (once), same as owner approval
    select referrer_id into v_referrer
      from public.referrals where referee_id = v_uid and status = 'pending' limit 1;
    if v_referrer is not null then
      update public.referrals set status='rewarded', rewarded_at=now()
       where referee_id = v_uid and status='pending';
      perform public._award_stamp(v_referrer, p_restaurant_id, null);
    end if;

    insert into public.scan_events (restaurant_id, customer_id, branch_id, status, resolved_at)
    values (p_restaurant_id, v_uid, p_branch_id, 'approved', now())
    returning * into v_scan;
    return v_scan;
  end if;

  -- Normal mode: reuse a recent pending scan, else create one.
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
