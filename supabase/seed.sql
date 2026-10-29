-- Demo data. Run after migrations. Owner user is created via Auth;
-- replace the owner UUID below with a real auth user id, or seed through the app.
-- These inserts assume an existing profile id — see README "Seed".

insert into public.hero_banners (title, subtitle, image_url, sort_order) values
  ('Earn free rewards nearby', 'Collect stamps at cafés, salons & more', null, 0)
on conflict do nothing;

-- Example public restaurant (owner_id must reference a real profile).
-- Uncomment and set :owner_id after creating an owner account.
-- insert into public.restaurants (owner_id, name, slug, category, phone, address, stamps_required, reward_title, scratch_enabled, scratch_prizes)
-- values ('<OWNER_PROFILE_UUID>', 'Borcella Coffee', 'borcella-coffee', 'cafe', '+91...', 'MG Road', 5,
--         'Free cupcake of your choice', true,
--         '[{"label":"10% off","weight":50},{"label":"Free espresso","weight":20},{"label":"Better luck next time","weight":30}]');
