-- 0015 — Feedback IQ: a free QR that takes a customer straight to the shop's
-- Google review page.
--
-- Positioning note that is also a legal one: this is sold as "one scan, no
-- typing, no searching" — never as a way to solicit only happy customers.
-- Selectively soliciting positive reviews is review gating; Google prohibits it
-- and penalises listings for it. The product is the frictionlessness, not any
-- filtering, so nothing here routes or screens anyone.

alter table public.restaurants
  add column if not exists review_qr_enabled boolean not null default true;

create table if not exists public.review_qr_scans (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  scanned_at    timestamptz not null default now(),
  -- Deliberately NOT stored: user id, IP, user agent. The owner needs a count
  -- to know the stand is working; nothing here needs to identify a person, and
  -- anonymous counting keeps this outside the privacy policy's data promises.
  day           date not null default (now() at time zone 'utc')::date
);

create index if not exists review_qr_scans_idx
  on public.review_qr_scans(restaurant_id, scanned_at desc);

alter table public.review_qr_scans enable row level security;

-- Owners read their own counts. Nobody reads anyone else's; nobody writes from
-- the client — scans are recorded server-side on redirect.
create policy "review qr scans owner read" on public.review_qr_scans
  for select using (public.owns_restaurant(restaurant_id));

/**
 * Record a scan and hand back the destination.
 * SECURITY DEFINER so an anonymous visitor can be counted without being able to
 * read or write the table directly.
 */
create or replace function public.log_review_scan(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest public.restaurants;
begin
  select * into v_rest
  from public.restaurants
  where slug = p_slug and is_active and review_qr_enabled;

  if not found or coalesce(v_rest.google_review_url, '') = '' then
    return null;
  end if;

  insert into public.review_qr_scans (restaurant_id) values (v_rest.id);
  return v_rest.google_review_url;
end $$;

grant execute on function public.log_review_scan(text) to anon, authenticated;
