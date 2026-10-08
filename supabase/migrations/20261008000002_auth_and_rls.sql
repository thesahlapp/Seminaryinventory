-- =============================================================================
-- Auth integration and row-level security.
--
-- Roles:
--   admin  - manages categories, locations, sizes and users; everything staff can do
--   staff  - creates/edits items, variants, photos and changes stock
--   viewer - read-only
--
-- Sign-up is invite-only (disabled in Auth settings). The FIRST user to sign in
-- becomes an admin automatically; everyone after that starts as staff.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helpers (in the non-exposed "private" schema)
-- -----------------------------------------------------------------------------

create function private.user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.user_role() = 'admin', false);
$$;

create function private.can_edit()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.user_role() in ('admin', 'staff'), false);
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.user_role(), private.is_admin(), private.can_edit() to authenticated;

-- -----------------------------------------------------------------------------
-- Create a profile whenever an auth user is created (invite or dashboard)
-- -----------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case
      when exists (select 1 from public.profiles) then 'staff'::public.app_role
      else 'admin'::public.app_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Only admins may change roles (SQL editor / service role, where there is no
-- signed-in user, is allowed too). Users may not demote the last admin.
create function private.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not private.is_admin() then
      raise exception 'Only admins can change user roles'
        using errcode = 'insufficient_privilege';
    end if;

    if old.role = 'admin' and not exists (
      select 1 from public.profiles where role = 'admin' and id <> old.id
    ) then
      raise exception 'There must always be at least one admin'
        using errcode = 'check_violation';
    end if;
  end if;

  new.email := old.email;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function private.profiles_guard_role();

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.locations       enable row level security;
alter table public.sizes           enable row level security;
alter table public.items           enable row level security;
alter table public.item_variants   enable row level security;
alter table public.item_photos     enable row level security;
alter table public.stock_levels    enable row level security;
alter table public.stock_movements enable row level security;

-- Nothing is visible to signed-out visitors.
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Profiles: everyone signed in can see names (for history); edit own or admin.
-- -----------------------------------------------------------------------------

create policy "Signed-in users can view profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users update own profile; admins update any"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Reference lists: everyone reads, admins write.
-- -----------------------------------------------------------------------------

create policy "Signed-in users can view categories"
  on public.categories for select to authenticated using (true);
create policy "Admins can insert categories"
  on public.categories for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update categories"
  on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete categories"
  on public.categories for delete to authenticated using ((select private.is_admin()));

create policy "Signed-in users can view locations"
  on public.locations for select to authenticated using (true);
create policy "Admins can insert locations"
  on public.locations for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update locations"
  on public.locations for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete locations"
  on public.locations for delete to authenticated using ((select private.is_admin()));

create policy "Signed-in users can view sizes"
  on public.sizes for select to authenticated using (true);
create policy "Admins can insert sizes"
  on public.sizes for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update sizes"
  on public.sizes for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete sizes"
  on public.sizes for delete to authenticated using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Items, variants, photos: everyone reads, admin/staff write.
-- -----------------------------------------------------------------------------

create policy "Signed-in users can view items"
  on public.items for select to authenticated using (true);
create policy "Editors can insert items"
  on public.items for insert to authenticated with check ((select private.can_edit()));
create policy "Editors can update items"
  on public.items for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Editors can delete items"
  on public.items for delete to authenticated using ((select private.can_edit()));

create policy "Signed-in users can view item variants"
  on public.item_variants for select to authenticated using (true);
create policy "Editors can insert item variants"
  on public.item_variants for insert to authenticated with check ((select private.can_edit()));
create policy "Editors can update item variants"
  on public.item_variants for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Editors can delete item variants"
  on public.item_variants for delete to authenticated using ((select private.can_edit()));

create policy "Signed-in users can view item photos"
  on public.item_photos for select to authenticated using (true);
create policy "Editors can insert item photos"
  on public.item_photos for insert to authenticated with check ((select private.can_edit()));
create policy "Editors can update item photos"
  on public.item_photos for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Editors can delete item photos"
  on public.item_photos for delete to authenticated using ((select private.can_edit()));

-- -----------------------------------------------------------------------------
-- Stock: read-only through the API. All writes go through the stock functions,
-- which guarantees every change is recorded in stock_movements.
-- -----------------------------------------------------------------------------

create policy "Signed-in users can view stock levels"
  on public.stock_levels for select to authenticated using (true);

create policy "Signed-in users can view stock history"
  on public.stock_movements for select to authenticated using (true);

revoke insert, update, delete, truncate on public.stock_levels from authenticated;
revoke insert, update, delete, truncate on public.stock_movements from authenticated;
