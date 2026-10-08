-- Run after restoring a backup (scripts/restore-backup.sh does this for you).
-- Supabase's database dump leaves out anything attached to its own "auth" and
-- "storage" tables, so put back the two pieces the app adds there.

-- New sign-ups and invitees get a profile (from 20261008000002_auth_and_rls.sql).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Photo permissions (from 20261008000004_storage.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Signed-in users can view item photos" on storage.objects;
create policy "Signed-in users can view item photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'item-photos');

drop policy if exists "Editors can upload item photos" on storage.objects;
create policy "Editors can upload item photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (select private.can_edit()));

drop policy if exists "Editors can update item photos" on storage.objects;
create policy "Editors can update item photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'item-photos' and (select private.can_edit()))
  with check (bucket_id = 'item-photos' and (select private.can_edit()));

drop policy if exists "Editors can delete item photos" on storage.objects;
create policy "Editors can delete item photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (select private.can_edit()));
