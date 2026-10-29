-- ═══════════════════════════════════════════════════════════════════════
-- Rewardly — 0003 storage
-- Public 'images' bucket for logos, reward images and menu photos.
-- Anyone can read; an authenticated user may write only inside a folder
-- named after their own user id (path: <auth.uid()>/<file>).
-- ═══════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- public read
drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects
  for select using (bucket_id = 'images');

-- authenticated write to own folder
drop policy if exists "images owner insert" on storage.objects;
create policy "images owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images owner update" on storage.objects;
create policy "images owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images owner delete" on storage.objects;
create policy "images owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
