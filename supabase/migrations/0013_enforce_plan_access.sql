-- 0013 — enforce plan access in the DATABASE, not just in the page.
--
-- Bug this fixes: `create_scan` only checked `restaurants.is_active`. The
-- Razorpay webhook sets that false on cancellation/halt events — but a TRIAL
-- that simply runs out fires no webhook, so `is_active` stayed true forever.
--
-- Result: the public shop page correctly hid itself once a trial lapsed, while
-- the RPC underneath kept awarding stamps to anyone with a cached page, the
-- installed PWA, a bookmarked link, or the restaurant id. The free trial had no
-- end at the data layer.
--
-- Verified before the fix: page hidden ✓, create_scan still stamped ✗.

-- Mirrors accessFromSub() in src/lib/subscription.ts. Keep the two in step.
create or replace function public.shop_has_access(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when s.status = 'trial'  then coalesce(s.trial_end, 'epoch'::timestamptz) > now()
        -- An active plan with no period end is treated as good for one more day,
        -- matching the client so a webhook that is merely late can't lock a
        -- paying shop out of its own counter.
        when s.status = 'active' then coalesce(s.current_period_end, now() + interval '1 day') > now()
        else false
      end
      from public.subscriptions s
      where s.restaurant_id = p_restaurant_id
    ),
    false
  );
$$;

grant execute on function public.shop_has_access(uuid) to anon, authenticated;

-- create_scan: same behaviour as 0010, plus the plan gate.
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

  -- The gate. Without this a lapsed trial keeps stamping forever.
  if not public.shop_has_access(p_restaurant_id) then
    raise exception 'shop is not accepting stamps right now';
  end if;

  if v_rest.auto_approve and v_rest.reward_mode = 'stamps' then
    perform public._award_stamp(v_uid, p_restaurant_id, p_branch_id);

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

-- Scratch cards are the other way a lapsed shop could keep giving prizes away.
-- This is the ORIGINAL 0002 body, unchanged, with only the plan gate added.
-- (Note: it picks uniformly and ignores `weight` in scratch_prizes even though
--  the settings form collects weights — that is a separate pre-existing bug,
--  deliberately NOT fixed here so this migration stays a security fix only.)
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

  if not public.shop_has_access(p_restaurant_id) then
    raise exception 'shop is not accepting scratch cards right now';
  end if;

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
