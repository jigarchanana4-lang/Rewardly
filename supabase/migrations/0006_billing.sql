-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0006 billing / trial lifecycle
-- Owners may create their own trial subscription; activation & renewal are
-- written server-side (service role) after Razorpay signature verification.
-- ═══════════════════════════════════════════════════════════════════════

-- Let an owner start a trial for their own restaurant (status must be 'trial').
drop policy if exists "subs owner insert trial" on public.subscriptions;
create policy "subs owner insert trial" on public.subscriptions for insert
  with check (public.owns_restaurant(restaurant_id) and status = 'trial');
