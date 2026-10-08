-- =============================================================================
-- Storage: private bucket for item photos.
-- Files are stored as  item-photos/{item_id}/{random}.{ext}
-- and served to signed-in users through signed URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos',
  'item-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Signed-in users can view item photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'item-photos');

create policy "Editors can upload item photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (select private.can_edit()));

create policy "Editors can update item photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'item-photos' and (select private.can_edit()))
  with check (bucket_id = 'item-photos' and (select private.can_edit()));

create policy "Editors can delete item photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (select private.can_edit()));
