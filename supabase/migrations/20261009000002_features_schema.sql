-- =============================================================================
-- Tables and access rules for: low stock minimums, user preferences, costs,
-- photo captions, custom fields, kits, check-outs, suppliers and purchase
-- orders, audits (stock counts), comments and notifications.
--
-- Access summary (enforced here with row-level security):
--   everyone signed in : read inventory, kits, check-outs, audits, comments
--   editor + admin     : change items, kits, check-outs, counts, comment
--   admin only         : costs, suppliers, purchase orders, custom field setup,
--                        applying audits
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Low stock minimums and check-out flag
-- -----------------------------------------------------------------------------

alter table public.items
  add column min_quantity integer check (min_quantity >= 0),
  add column checkoutable boolean not null default false;

alter table public.item_variants
  add column min_quantity integer check (min_quantity >= 0);

-- -----------------------------------------------------------------------------
-- Per-user preferences
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  add column email_low_stock boolean not null default true,
  add column email_overdue boolean not null default true,
  add column email_mentions boolean not null default true;

-- -----------------------------------------------------------------------------
-- Costs: a separate table so that only admins can read them. (Row-level
-- security works on rows, so costs can't live in the items table.)
-- -----------------------------------------------------------------------------

create table public.item_costs (
  item_id      uuid primary key references public.items (id) on delete cascade,
  unit_cost    numeric(12, 2) check (unit_cost >= 0),
  retail_price numeric(12, 2) check (retail_price >= 0),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null default auth.uid()
);

create trigger item_costs_set_updated_at
  before update on public.item_costs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Photo captions
-- -----------------------------------------------------------------------------

alter table public.item_photos
  add column caption text check (length(caption) <= 80);

-- -----------------------------------------------------------------------------
-- Custom fields per category. Values live in items.custom_fields as
-- { "<field id>": value } so renaming a field never loses data.
-- -----------------------------------------------------------------------------

create type public.field_type as enum ('text', 'number', 'date', 'select', 'boolean');

create table public.category_fields (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  label       text not null check (length(trim(label)) between 1 and 60),
  field_type  public.field_type not null,
  options     text[] not null default '{}',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint category_fields_select_needs_options
    check (field_type <> 'select' or cardinality(options) > 0)
);

create unique index category_fields_label_key on public.category_fields (category_id, lower(label));

create trigger category_fields_set_updated_at
  before update on public.category_fields
  for each row execute function private.set_updated_at();

-- Keeps items.custom_fields consistent: drops values for fields that don't
-- belong to the item's category and rejects values of the wrong type.
create function private.items_clean_custom_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cleaned jsonb := '{}'::jsonb;
  entry record;
  field public.category_fields;
begin
  for entry in select key, value from jsonb_each(coalesce(new.custom_fields, '{}'::jsonb)) loop
    select * into field from public.category_fields
    where id::text = entry.key and category_id is not distinct from new.category_id;

    continue when field.id is null or entry.value = 'null'::jsonb;

    if field.field_type = 'number' and jsonb_typeof(entry.value) <> 'number' then
      raise exception '"%" must be a number', field.label using errcode = 'check_violation';
    elsif field.field_type = 'boolean' and jsonb_typeof(entry.value) <> 'boolean' then
      raise exception '"%" must be yes or no', field.label using errcode = 'check_violation';
    elsif field.field_type = 'date'
      and (jsonb_typeof(entry.value) <> 'string' or entry.value #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception '"%" must be a date', field.label using errcode = 'check_violation';
    elsif field.field_type = 'select' and not (entry.value #>> '{}' = any(field.options)) then
      raise exception '"%" must be one of: %', field.label, array_to_string(field.options, ', ')
        using errcode = 'check_violation';
    elsif field.field_type = 'text'
      and (jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 500) then
      raise exception '"%" must be text (up to 500 characters)', field.label using errcode = 'check_violation';
    end if;

    cleaned := cleaned || jsonb_build_object(entry.key, entry.value);
  end loop;

  new.custom_fields := cleaned;
  return new;
end;
$$;

create trigger items_clean_custom_fields
  before insert or update of custom_fields, category_id on public.items
  for each row execute function private.items_clean_custom_fields();

-- -----------------------------------------------------------------------------
-- Kits (bundles of items)
-- -----------------------------------------------------------------------------

create table public.kits (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  description    text,
  photo_path     text,
  thumbnail_path text,
  archived_at    timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index kits_name_key on public.kits (lower(name));

create trigger kits_set_updated_at
  before update on public.kits
  for each row execute function private.set_updated_at();

create table public.kit_items (
  kit_id     uuid not null references public.kits (id) on delete cascade,
  variant_id uuid not null references public.item_variants (id) on delete restrict,
  quantity   integer not null check (quantity > 0),
  primary key (kit_id, variant_id)
);

create index kit_items_variant_id_idx on public.kit_items (variant_id);

-- -----------------------------------------------------------------------------
-- Check-outs. Stock leaves its location when checked out (history reason
-- "checked_out") and comes back when checked in ("checked_in").
-- Writes go through the checkout functions only.
-- -----------------------------------------------------------------------------

create table public.checkouts (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated always as identity unique,
  borrower_name    text not null check (length(trim(borrower_name)) > 0),
  borrower_id      uuid references public.profiles (id) on delete set null,
  project          text,
  due_date         date not null,
  notes            text,
  kit_id           uuid references public.kits (id) on delete set null,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  closed_at        timestamptz,
  last_reminded_at timestamptz
);

create index checkouts_open_idx on public.checkouts (due_date) where closed_at is null;
create index checkouts_borrower_idx on public.checkouts (borrower_id);
create index checkouts_kit_idx on public.checkouts (kit_id);

create table public.checkout_lines (
  id               uuid primary key default gen_random_uuid(),
  checkout_id      uuid not null references public.checkouts (id) on delete cascade,
  variant_id       uuid not null references public.item_variants (id) on delete restrict,
  location_id      uuid not null references public.locations (id) on delete restrict,
  quantity         integer not null check (quantity > 0),
  returned_good    integer not null default 0 check (returned_good >= 0),
  returned_damaged integer not null default 0 check (returned_damaged >= 0),
  missing          integer not null default 0 check (missing >= 0),
  condition_note   text,
  returned_at      timestamptz,
  returned_by      uuid references public.profiles (id) on delete set null,
  constraint checkout_lines_settled_within_quantity
    check (returned_good + returned_damaged + missing <= quantity)
);

create index checkout_lines_checkout_idx on public.checkout_lines (checkout_id);
create index checkout_lines_variant_idx on public.checkout_lines (variant_id);

-- -----------------------------------------------------------------------------
-- Suppliers and purchase orders (admin only: they contain costs)
-- -----------------------------------------------------------------------------

create type public.po_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  contact_name text,
  email        text,
  phone        text,
  website      text,
  notes        text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index suppliers_name_key on public.suppliers (lower(name));

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function private.set_updated_at();

create table public.purchase_orders (
  id                      uuid primary key default gen_random_uuid(),
  number                  bigint generated always as identity unique,
  supplier_id             uuid not null references public.suppliers (id) on delete restrict,
  status                  public.po_status not null default 'draft',
  destination_location_id uuid not null references public.locations (id) on delete restrict,
  expected_date           date,
  notes                   text,
  ordered_at              timestamptz,
  received_at             timestamptz,
  created_by              uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function private.set_updated_at();

create table public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  variant_id        uuid not null references public.item_variants (id) on delete restrict,
  quantity_ordered  integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  unit_cost         numeric(12, 2) check (unit_cost >= 0),
  unique (purchase_order_id, variant_id)
);

create index purchase_order_lines_variant_idx on public.purchase_order_lines (variant_id);

-- -----------------------------------------------------------------------------
-- Audits (stock counts) for one location
-- -----------------------------------------------------------------------------

create type public.audit_status as enum ('in_progress', 'completed', 'cancelled');

create table public.audits (
  id           uuid primary key default gen_random_uuid(),
  number       bigint generated always as identity unique,
  location_id  uuid not null references public.locations (id) on delete restrict,
  status       public.audit_status not null default 'in_progress',
  notes        text,
  started_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  started_at   timestamptz not null default now(),
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz
);

create index audits_location_idx on public.audits (location_id, started_at desc);

create table public.audit_lines (
  id                   uuid primary key default gen_random_uuid(),
  audit_id             uuid not null references public.audits (id) on delete cascade,
  variant_id           uuid not null references public.item_variants (id) on delete restrict,
  expected_quantity    integer not null,
  counted_quantity     integer check (counted_quantity >= 0),
  counted_by           uuid references public.profiles (id) on delete set null,
  counted_at           timestamptz,
  applied_old_quantity integer,
  applied_new_quantity integer,
  unique (audit_id, variant_id)
);

-- -----------------------------------------------------------------------------
-- Comments and notifications
-- -----------------------------------------------------------------------------

create table public.item_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null default auth.uid(),
  body       text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);

create index item_comments_item_idx on public.item_comments (item_id, created_at);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('mention')),
  item_id      uuid references public.items (id) on delete cascade,
  comment_id   uuid references public.item_comments (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  emailed_at   timestamptz
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- Mentions are written in comments as @[Name](profile-id). Each new mention
-- creates a notification for that person (not for mentioning yourself).
create function private.item_comments_notify_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, kind, item_id, comment_id, actor_id)
  select distinct m.id, 'mention', new.item_id, new.id, new.author_id
  from regexp_matches(new.body, '@\[[^\]]*\]\(([0-9a-fA-F-]{36})\)', 'g') as match(groups)
  join public.profiles m on m.id = (match.groups[1])::uuid
  where m.id is distinct from new.author_id
    and (
      tg_op = 'INSERT'
      or position(match.groups[1] in old.body) = 0
    );
  return new;
end;
$$;

create trigger item_comments_notify_mentions
  after insert or update of body on public.item_comments
  for each row execute function private.item_comments_notify_mentions();

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

alter table public.item_costs           enable row level security;
alter table public.category_fields      enable row level security;
alter table public.kits                 enable row level security;
alter table public.kit_items            enable row level security;
alter table public.checkouts            enable row level security;
alter table public.checkout_lines       enable row level security;
alter table public.suppliers            enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.audits               enable row level security;
alter table public.audit_lines          enable row level security;
alter table public.item_comments        enable row level security;
alter table public.notifications        enable row level security;

revoke all on public.item_costs, public.category_fields, public.kits, public.kit_items,
  public.checkouts, public.checkout_lines, public.suppliers, public.purchase_orders,
  public.purchase_order_lines, public.audits, public.audit_lines, public.item_comments,
  public.notifications
from anon;

-- Admin-only tables: every operation, including reading.
create policy "Admins manage item costs" on public.item_costs for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage suppliers" on public.suppliers for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage purchase orders" on public.purchase_orders for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage purchase order lines" on public.purchase_order_lines for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Custom field definitions: everyone reads, admins change.
create policy "Signed-in users can view custom fields" on public.category_fields for select to authenticated
  using (true);
create policy "Admins insert custom fields" on public.category_fields for insert to authenticated
  with check ((select private.is_admin()));
create policy "Admins update custom fields" on public.category_fields for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete custom fields" on public.category_fields for delete to authenticated
  using ((select private.is_admin()));

-- Kits: everyone reads, editors change.
create policy "Signed-in users can view kits" on public.kits for select to authenticated using (true);
create policy "Editors insert kits" on public.kits for insert to authenticated with check ((select private.can_edit()));
create policy "Editors update kits" on public.kits for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Editors delete kits" on public.kits for delete to authenticated using ((select private.can_edit()));

create policy "Signed-in users can view kit items" on public.kit_items for select to authenticated using (true);
create policy "Editors insert kit items" on public.kit_items for insert to authenticated
  with check ((select private.can_edit()));
create policy "Editors update kit items" on public.kit_items for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Editors delete kit items" on public.kit_items for delete to authenticated
  using ((select private.can_edit()));

-- Check-outs: everyone reads. Creating and checking in go through functions;
-- editors may adjust the due date, project, borrower name and notes.
create policy "Signed-in users can view check-outs" on public.checkouts for select to authenticated using (true);
create policy "Editors update check-out details" on public.checkouts for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
revoke insert, update, delete, truncate on public.checkouts from authenticated;
grant update (due_date, project, borrower_name, notes) on public.checkouts to authenticated;

create policy "Signed-in users can view check-out lines" on public.checkout_lines for select to authenticated
  using (true);
revoke insert, update, delete, truncate on public.checkout_lines from authenticated;

-- Audits: everyone reads; counting and applying go through functions.
create policy "Signed-in users can view audits" on public.audits for select to authenticated using (true);
create policy "Signed-in users can view audit lines" on public.audit_lines for select to authenticated using (true);
revoke insert, update, delete, truncate on public.audits, public.audit_lines from authenticated;

-- Comments: everyone reads; editors and admins post as themselves; authors
-- edit their own; authors or admins delete.
create policy "Signed-in users can view comments" on public.item_comments for select to authenticated
  using (true);
create policy "Editors post comments as themselves" on public.item_comments for insert to authenticated
  with check ((select private.can_edit()) and author_id = (select auth.uid()));
create policy "Authors edit their comments" on public.item_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Authors or admins delete comments" on public.item_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));
revoke update on public.item_comments from authenticated;
grant update (body, edited_at) on public.item_comments to authenticated;

-- Notifications: each person sees and marks only their own.
create policy "Users see their notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "Users mark their notifications read" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "Users delete their notifications" on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Profiles: people may change their own name and preferences, never their
-- role (trigger) or email (trigger keeps the original).
revoke update on public.profiles from authenticated;
grant update (full_name, role, theme, email_low_stock, email_overdue, email_mentions)
  on public.profiles to authenticated;
