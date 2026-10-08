-- =============================================================================
-- Core schema: profiles, categories, locations, sizes, items, variants, photos,
-- stock levels and the stock movement history.
--
-- Stock is tracked per VARIANT per LOCATION. Every item has at least one
-- variant: sized items get one variant per size, unsized items get a single
-- "default" variant whose size_id is null.
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'staff', 'viewer');

-- 'kit' is reserved for future kits/bundles support.
create type public.item_type as enum ('standard', 'kit');

create type public.stock_reason as enum (
  'initial_count',
  'received',
  'issued',
  'returned',
  'count_correction',
  'damaged',
  'lost',
  'transfer_in',
  'transfer_out',
  'other'
);

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (one per auth user)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        public.app_role not null default 'staff',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------

create table public.categories (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) > 0),
  description        text,
  default_has_sizes  boolean not null default false,
  sort_order         integer not null default 0,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index categories_name_key on public.categories (lower(name));

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Locations
-- -----------------------------------------------------------------------------

create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  address      text,
  description  text,
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index locations_name_key on public.locations (lower(name));

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sizes (master list: standard XS-XXL plus custom sizes)
-- -----------------------------------------------------------------------------

create table public.sizes (
  id           uuid primary key default gen_random_uuid(),
  label        text not null check (length(trim(label)) > 0),
  sort_order   integer not null default 0,
  is_standard  boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index sizes_label_key on public.sizes (lower(label));

create trigger sizes_set_updated_at
  before update on public.sizes
  for each row execute function private.set_updated_at();

insert into public.sizes (label, sort_order, is_standard) values
  ('XS',  10, true),
  ('S',   20, true),
  ('M',   30, true),
  ('L',   40, true),
  ('XL',  50, true),
  ('XXL', 60, true);

-- -----------------------------------------------------------------------------
-- Items
-- -----------------------------------------------------------------------------

create table public.items (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  description    text,
  -- "on delete restrict": a category that still has items cannot be deleted.
  category_id    uuid references public.categories (id) on delete restrict,
  sku            text check (sku is null or length(trim(sku)) > 0),
  notes          text,
  has_sizes      boolean not null default false,
  item_type      public.item_type not null default 'standard',
  -- Reserved for future per-category custom fields.
  custom_fields  jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(custom_fields) = 'object'),
  archived_at    timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index items_sku_key on public.items (lower(sku)) where sku is not null;
create index items_category_id_idx on public.items (category_id);
create index items_name_idx on public.items (lower(name));

create function private.items_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger items_before_update
  before update on public.items
  for each row execute function private.items_before_update();

-- -----------------------------------------------------------------------------
-- Item variants (the unit that stock is counted against)
-- -----------------------------------------------------------------------------

create table public.item_variants (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items (id) on delete cascade,
  -- null = the single default variant of an item without sizes.
  size_id      uuid references public.sizes (id) on delete restrict,
  sku          text check (sku is null or length(trim(sku)) > 0),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One variant per (item, size); nulls not distinct = at most one default variant.
  constraint item_variants_item_size_key unique nulls not distinct (item_id, size_id)
);

create unique index item_variants_sku_key on public.item_variants (lower(sku)) where sku is not null;
create index item_variants_size_id_idx on public.item_variants (size_id);

create trigger item_variants_set_updated_at
  before update on public.item_variants
  for each row execute function private.set_updated_at();

-- A sized item's variants must have a size; an unsized item's must not.
create function private.item_variants_check_size()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_has_sizes boolean;
begin
  select has_sizes into v_has_sizes from public.items where id = new.item_id;

  if v_has_sizes and new.size_id is null then
    raise exception 'Item uses sizes, so each variant needs a size'
      using errcode = 'check_violation';
  elsif not v_has_sizes and new.size_id is not null then
    raise exception 'Item does not use sizes, so its variant cannot have a size'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger item_variants_check_size
  before insert or update of item_id, size_id on public.item_variants
  for each row execute function private.item_variants_check_size();

-- Unsized items automatically get their default variant.
create function private.items_create_default_variant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.has_sizes then
    insert into public.item_variants (item_id, size_id) values (new.id, null);
  end if;
  return new;
end;
$$;

create trigger items_create_default_variant
  after insert on public.items
  for each row execute function private.items_create_default_variant();

-- Switching an item between sized/unsized is only allowed before any stock
-- has been recorded against it; the old variants are replaced.
create function private.items_handle_has_sizes_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.has_sizes is distinct from old.has_sizes then
    if exists (
      select 1
      from public.stock_movements m
      join public.item_variants v on v.id = m.variant_id
      where v.item_id = new.id
    ) then
      raise exception 'Cannot change whether "%" uses sizes after stock has been recorded. Archive it and create a new item instead.', new.name
        using errcode = 'check_violation';
    end if;

    delete from public.item_variants where item_id = new.id;

    if not new.has_sizes then
      insert into public.item_variants (item_id, size_id) values (new.id, null);
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Item photos (multiple per item; files live in the 'item-photos' bucket)
-- -----------------------------------------------------------------------------

create table public.item_photos (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items (id) on delete cascade,
  storage_path  text not null unique,
  alt_text      text,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

create index item_photos_item_id_idx on public.item_photos (item_id, sort_order);

-- -----------------------------------------------------------------------------
-- Stock levels (current quantity per variant per location)
-- Never written directly by the app: use set_stock / change_stock / transfer_stock.
-- -----------------------------------------------------------------------------

create table public.stock_levels (
  variant_id   uuid not null references public.item_variants (id) on delete cascade,
  -- "on delete restrict": a location that holds stock cannot be deleted.
  location_id  uuid not null references public.locations (id) on delete restrict,
  quantity     integer not null default 0 check (quantity >= 0),
  updated_at   timestamptz not null default now(),
  primary key (variant_id, location_id)
);

create index stock_levels_location_id_idx on public.stock_levels (location_id);

-- -----------------------------------------------------------------------------
-- Stock movements (append-only quantity history)
-- -----------------------------------------------------------------------------

create table public.stock_movements (
  id                 bigint generated always as identity primary key,
  -- "on delete restrict": anything with history must be archived, not deleted.
  variant_id         uuid not null references public.item_variants (id) on delete restrict,
  location_id        uuid not null references public.locations (id) on delete restrict,
  old_quantity       integer not null check (old_quantity >= 0),
  new_quantity       integer not null check (new_quantity >= 0),
  delta              integer generated always as (new_quantity - old_quantity) stored,
  reason             public.stock_reason not null,
  reason_note        text,
  changed_by         uuid references public.profiles (id) on delete set null,
  -- Snapshot so the history still says who made a change if the user is removed.
  changed_by_email   text,
  changed_at         timestamptz not null default now(),
  -- Links the transfer_out and transfer_in rows of one transfer.
  transfer_group_id  uuid,
  -- Reserved for future links to purchase order lines, check-outs, etc.
  reference_type     text,
  reference_id       uuid,
  constraint stock_movements_quantity_changed check (old_quantity <> new_quantity),
  constraint stock_movements_other_needs_note
    check (reason <> 'other' or length(trim(coalesce(reason_note, ''))) > 0),
  constraint stock_movements_transfer_grouped
    check ((reason in ('transfer_in', 'transfer_out')) = (transfer_group_id is not null)),
  constraint stock_movements_reference_pair
    check ((reference_type is null) = (reference_id is null))
);

create index stock_movements_variant_location_idx
  on public.stock_movements (variant_id, location_id, changed_at desc);
create index stock_movements_location_idx on public.stock_movements (location_id, changed_at desc);
create index stock_movements_changed_at_idx on public.stock_movements (changed_at desc);
create index stock_movements_changed_by_idx on public.stock_movements (changed_by);
create index stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id) where reference_type is not null;

-- Defined after stock_movements because it references it.
create trigger items_handle_has_sizes_change
  after update of has_sizes on public.items
  for each row execute function private.items_handle_has_sizes_change();

-- -----------------------------------------------------------------------------
-- Convenience view: one row per variant per location with readable names.
-- security_invoker makes it respect the caller's row-level security.
-- -----------------------------------------------------------------------------

create view public.inventory_levels
with (security_invoker = true)
as
select
  sl.variant_id,
  sl.location_id,
  i.id            as item_id,
  i.name          as item_name,
  i.sku           as item_sku,
  v.sku           as variant_sku,
  i.category_id,
  c.name          as category_name,
  s.id            as size_id,
  s.label         as size_label,
  s.sort_order    as size_sort_order,
  l.name          as location_name,
  sl.quantity,
  sl.updated_at
from public.stock_levels sl
join public.item_variants v on v.id = sl.variant_id
join public.items i on i.id = v.item_id
join public.locations l on l.id = sl.location_id
left join public.categories c on c.id = i.category_id
left join public.sizes s on s.id = v.size_id;
