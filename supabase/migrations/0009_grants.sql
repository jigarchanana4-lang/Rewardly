-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0009 role grants
-- Grant table/function privileges to the Supabase API roles. Row access is
-- still governed by RLS; these are the table-level GRANTs PostgREST needs.
-- (Hosted Supabase applies these via default privileges; local needs them
-- explicit. Idempotent + safe to run anywhere.)
-- ═══════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
