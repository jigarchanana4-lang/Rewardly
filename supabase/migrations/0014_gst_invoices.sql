-- 0014 — GST invoices.
--
-- Indian businesses need a compliant tax invoice to claim input credit. Without
-- one, "can I get a GST invoice?" is a lost sale on the first B2B enquiry.
--
-- Amounts charged are treated as GST-INCLUSIVE and the tax is back-calculated,
-- so an invoice always reconciles exactly with what Razorpay actually took. The
-- alternative (tax on top) would print totals the customer was never charged.

alter table public.restaurants
  add column if not exists gstin          text,
  add column if not exists billing_state  text,   -- e.g. "Maharashtra"
  add column if not exists billing_address text;

alter table public.restaurants
  drop constraint if exists restaurants_gstin_format;
alter table public.restaurants
  add constraint restaurants_gstin_format
  check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');

create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  number              text not null unique,        -- RW/2026-27/0001
  financial_year      text not null,               -- 2026-27
  seq                 int  not null,
  issued_at           timestamptz not null default now(),

  tier                text,
  razorpay_payment_id text unique,                 -- idempotency: one invoice per payment

  -- All amounts in paise, to avoid float drift on money.
  total_paise         bigint not null,             -- what was actually charged
  taxable_paise       bigint not null,
  tax_paise           bigint not null,
  gst_rate            numeric(4,2) not null default 18.00,
  -- Intra-state splits into CGST+SGST; inter-state is a single IGST line.
  is_interstate       boolean not null default false,

  supplier_name       text not null,
  supplier_gstin      text,
  supplier_state      text,
  buyer_name          text not null,
  buyer_gstin         text,
  buyer_state         text,
  buyer_address       text,
  sac_code            text not null default '998314',

  unique (financial_year, seq)
);

create index if not exists invoices_restaurant_idx on public.invoices(restaurant_id, issued_at desc);

alter table public.invoices enable row level security;

-- Owners read their own invoices. Nobody writes from the client — invoices are
-- created server-side from a verified payment only.
create policy "invoices owner read" on public.invoices
  for select using (public.owns_restaurant(restaurant_id));

-- Indian financial year runs April–March.
create or replace function public.current_financial_year()
returns text language sql stable as $$
  select case when extract(month from now()) >= 4
    then extract(year from now())::int || '-' || right((extract(year from now())::int + 1)::text, 2)
    else (extract(year from now())::int - 1) || '-' || right(extract(year from now())::int::text, 2)
  end;
$$;

/**
 * Allocate the next invoice number for the current financial year.
 * Sequential and gap-free per FY, which is what the GST rules require — so it
 * takes a lock rather than using a sequence (sequences skip on rollback).
 */
create or replace function public.next_invoice_seq(p_fy text)
returns int language plpgsql security definer set search_path = public as $$
declare v_seq int;
begin
  -- Serialise allocation for this FY against concurrent payments.
  perform pg_advisory_xact_lock(hashtext('invoice_seq:' || p_fy));
  select coalesce(max(seq), 0) + 1 into v_seq from public.invoices where financial_year = p_fy;
  return v_seq;
end $$;

revoke execute on function public.next_invoice_seq(text) from anon, authenticated;
