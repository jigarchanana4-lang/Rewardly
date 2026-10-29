-- 0011 — let the public shop page read a shop's plan status.
--
-- Bug this fixes: `subscriptions` is owner-read only (policy "subs owner read"),
-- so an anonymous visitor's SELECT returned zero rows and accessFromSub(null)
-- resolved to state "none". Every public shop page therefore rendered the
-- "not stamping right now" screen — even for shops on a paid, active plan.
--
-- We do NOT open up the subscriptions table (it holds Razorpay ids). Instead a
-- SECURITY DEFINER function exposes only the three fields the access check
-- needs, for one restaurant at a time.

create or replace function public.shop_plan(p_restaurant_id uuid)
returns table (
  status             sub_status,
  trial_end          timestamptz,
  current_period_end timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.status, s.trial_end, s.current_period_end
  from public.subscriptions s
  where s.restaurant_id = p_restaurant_id;
$$;

grant execute on function public.shop_plan(uuid) to anon, authenticated;
