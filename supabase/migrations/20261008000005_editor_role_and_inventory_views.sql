-- =============================================================================
-- 1. Rename the "staff" role to "editor".
-- 2. Make sure there is always an admin (the earliest user, if none exists).
-- 3. Photo thumbnails.
-- 4. inventory_items(): search / filter / sort for the inventory page.
-- 5. location_summaries: item counts and unit totals per location.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. staff -> editor
-- -----------------------------------------------------------------------------

alter type public.app_role rename value 'staff' to 'editor';
alter table public.profiles alter column role set default 'editor';

-- These functions mention the role by name, so they are recreated.
create or replace function private.can_edit()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.user_role() in ('admin', 'editor'), false);
$$;

create or replace function private.handle_new_user()
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
      when exists (select 1 from public.profiles) then 'editor'::public.app_role
      else 'admin'::public.app_role
    end
  );
  return new;
end;
$$;

revoke all on function private.can_edit(), private.handle_new_user() from public, anon, authenticated;
grant execute on function private.can_edit() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. If nobody is an admin (e.g. users were created before the migrations ran),
--    the earliest user becomes the admin.
-- -----------------------------------------------------------------------------

update public.profiles
set role = 'admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- -----------------------------------------------------------------------------
-- 3. Small thumbnail stored next to each photo (used by the inventory grid).
-- -----------------------------------------------------------------------------

alter table public.item_photos add column thumbnail_path text;

-- -----------------------------------------------------------------------------
-- 4. inventory_items(): one row per item with totals, for the inventory page.
--
--   p_search         matches name or SKU (case-insensitive)
--   p_category_ids   only these categories (empty = all) ...
--   p_uncategorized  ... plus items without a category
--   p_location_ids   only items stocked at these locations (empty = all);
--                    quantities are then counted at these locations only
--   p_sort           'name' | 'quantity' | 'category' | 'updated'
--
-- Runs with the caller's permissions, so row-level security applies.
-- -----------------------------------------------------------------------------

create function public.inventory_items(
  p_search        text    default null,
  p_category_ids  uuid[]  default null,
  p_uncategorized boolean default false,
  p_location_ids  uuid[]  default null,
  p_archived      boolean default false,
  p_sort          text    default 'name',
  p_descending    boolean default false,
  p_limit         integer default 60,
  p_offset        integer default 0
)
returns table (
  id             uuid,
  name           text,
  sku            text,
  has_sizes      boolean,
  archived_at    timestamptz,
  category_id    uuid,
  category_name  text,
  photo_path     text,
  total_quantity bigint,
  last_updated   timestamptz,
  variants       jsonb,
  levels         jsonb,
  total_count    bigint
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      nullif(trim(p_search), '') as search,
      coalesce(cardinality(p_category_ids), 0) > 0 or p_uncategorized as by_category,
      coalesce(cardinality(p_location_ids), 0) > 0 as by_location
  ),
  matched as (
    select i.*
    from public.items i, params
    where (i.archived_at is not null) = p_archived
      and (
        params.search is null
        or i.name ilike '%' || replace(replace(replace(params.search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or i.sku  ilike '%' || replace(replace(replace(params.search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
      and (
        not params.by_category
        or i.category_id = any(p_category_ids)
        or (p_uncategorized and i.category_id is null)
      )
      and (
        not params.by_location
        or exists (
          select 1
          from public.stock_levels sl
          join public.item_variants v on v.id = sl.variant_id
          where v.item_id = i.id and sl.location_id = any(p_location_ids)
        )
      )
  ),
  summarized as (
    select
      m.id,
      m.name,
      m.sku,
      m.has_sizes,
      m.archived_at,
      m.category_id,
      c.name as category_name,
      photo.path as photo_path,
      coalesce(stock.total, 0)::bigint as total_quantity,
      greatest(m.updated_at, stock.last_change) as last_updated,
      coalesce(variant_list.variants, '[]'::jsonb) as variants,
      coalesce(stock.levels, '[]'::jsonb) as levels
    from matched m
    cross join params
    left join public.categories c on c.id = m.category_id
    left join lateral (
      select coalesce(p.thumbnail_path, p.storage_path) as path
      from public.item_photos p
      where p.item_id = m.id
      order by p.sort_order, p.created_at
      limit 1
    ) photo on true
    left join lateral (
      select
        sum(sl.quantity) as total,
        max(sl.updated_at) as last_change,
        jsonb_agg(
          jsonb_build_object('variant_id', sl.variant_id, 'location_id', sl.location_id, 'quantity', sl.quantity)
        ) as levels
      from public.stock_levels sl
      join public.item_variants v on v.id = sl.variant_id
      where v.item_id = m.id
        and (not params.by_location or sl.location_id = any(p_location_ids))
    ) stock on true
    left join lateral (
      select jsonb_agg(
               jsonb_build_object('id', v.id, 'label', s.label)
               order by s.sort_order nulls first, s.label
             ) as variants
      from public.item_variants v
      left join public.sizes s on s.id = v.size_id
      where v.item_id = m.id and v.archived_at is null
    ) variant_list on true
  )
  select s.*, count(*) over () as total_count
  from summarized s
  order by
    case when p_sort = 'quantity' and not p_descending then s.total_quantity end asc,
    case when p_sort = 'quantity' and p_descending then s.total_quantity end desc,
    case when p_sort = 'category' and not p_descending then lower(s.category_name) end asc nulls last,
    case when p_sort = 'category' and p_descending then lower(s.category_name) end desc nulls last,
    case when p_sort = 'updated' and not p_descending then s.last_updated end asc,
    case when p_sort = 'updated' and p_descending then s.last_updated end desc,
    case when p_sort = 'name' and p_descending then lower(s.name) end desc,
    lower(s.name) asc,
    s.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.inventory_items(text, uuid[], boolean, uuid[], boolean, text, boolean, integer, integer)
  from public, anon;
grant execute on function public.inventory_items(text, uuid[], boolean, uuid[], boolean, text, boolean, integer, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Per-location totals for the Locations tab.
-- -----------------------------------------------------------------------------

create view public.location_summaries
with (security_invoker = true)
as
select
  l.id,
  l.name,
  l.address,
  l.description,
  l.sort_order,
  l.archived_at,
  count(distinct v.item_id) filter (where sl.quantity > 0) as item_count,
  coalesce(sum(sl.quantity), 0)::bigint as total_units
from public.locations l
left join public.stock_levels sl on sl.location_id = l.id
left join public.item_variants v on v.id = sl.variant_id
group by l.id;

revoke all on public.location_summaries from anon;
