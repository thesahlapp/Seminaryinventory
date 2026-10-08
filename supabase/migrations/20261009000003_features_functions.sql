-- =============================================================================
-- Functions for: check-outs, kits, purchase order receiving, audits, low stock,
-- inventory value, the dashboard, and the upgraded inventory search.
-- Every quantity change goes through private.record_stock_change, so it is
-- logged in stock_movements.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create function private.try_numeric(value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::numeric;
exception when others then
  return null;
end;
$$;

create function private.assert_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can do that' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function private.assert_editor()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.can_edit() then
    raise exception 'You have view-only access' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Quantity currently checked out, per variant.
create view public.checked_out_quantities
with (security_invoker = true)
as
select
  cl.variant_id,
  sum(cl.quantity - cl.returned_good - cl.returned_damaged - cl.missing)::bigint as quantity
from public.checkout_lines cl
join public.checkouts c on c.id = cl.checkout_id
where c.closed_at is null
group by cl.variant_id
having sum(cl.quantity - cl.returned_good - cl.returned_damaged - cl.missing) > 0;

revoke all on public.checked_out_quantities from anon;

-- -----------------------------------------------------------------------------
-- set_stock / change_stock: also refuse the reasons that belong to check-outs
-- and audits (those must go through their own functions).
-- -----------------------------------------------------------------------------

create or replace function public.set_stock(
  p_variant_id   uuid,
  p_location_id  uuid,
  p_new_quantity integer,
  p_reason       public.stock_reason,
  p_note         text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer;
begin
  perform private.assert_can_edit_stock(p_variant_id, p_location_id);

  if p_reason::text in ('transfer_in', 'transfer_out', 'checked_out', 'checked_in', 'audit_correction') then
    raise exception 'That reason is recorded automatically and can''t be chosen here'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'Quantity cannot be negative' using errcode = 'check_violation';
  end if;

  v_old := private.lock_stock_level(p_variant_id, p_location_id);
  return private.record_stock_change(p_variant_id, p_location_id, v_old, p_new_quantity, p_reason, p_note);
end;
$$;

create or replace function public.change_stock(
  p_variant_id  uuid,
  p_location_id uuid,
  p_delta       integer,
  p_reason      public.stock_reason,
  p_note        text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer;
begin
  perform private.assert_can_edit_stock(p_variant_id, p_location_id);

  if p_reason::text in ('transfer_in', 'transfer_out', 'checked_out', 'checked_in', 'audit_correction') then
    raise exception 'That reason is recorded automatically and can''t be chosen here'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'Change amount cannot be zero' using errcode = 'invalid_parameter_value';
  end if;

  v_old := private.lock_stock_level(p_variant_id, p_location_id);
  return private.record_stock_change(p_variant_id, p_location_id, v_old, v_old + p_delta, p_reason, p_note);
end;
$$;

-- -----------------------------------------------------------------------------
-- Check-out
--   p_lines: [{ "variant_id": uuid, "location_id": uuid, "quantity": int }]
-- -----------------------------------------------------------------------------

create function private.create_checkout(
  p_borrower_name text,
  p_borrower_id   uuid,
  p_project       text,
  p_due_date      date,
  p_notes         text,
  p_lines         jsonb,
  p_kit_id        uuid
)
returns public.checkouts
language plpgsql
set search_path = ''
as $$
declare
  v_checkout public.checkouts;
  v_line record;
  v_old integer;
  v_name text;
begin
  if nullif(trim(p_borrower_name), '') is null and p_borrower_id is not null then
    select coalesce(full_name, email) into p_borrower_name from public.profiles where id = p_borrower_id;
  end if;
  if nullif(trim(p_borrower_name), '') is null then
    raise exception 'Enter who is taking the items' using errcode = 'check_violation';
  end if;
  if p_due_date is null then
    raise exception 'Choose a due date' using errcode = 'check_violation';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Choose at least one item' using errcode = 'check_violation';
  end if;

  insert into public.checkouts (borrower_name, borrower_id, project, due_date, notes, kit_id)
  values (trim(p_borrower_name), p_borrower_id, nullif(trim(p_project), ''), p_due_date, nullif(trim(p_notes), ''), p_kit_id)
  returning * into v_checkout;

  -- Same variant + location requested twice is combined into one line.
  for v_line in
    select (l ->> 'variant_id')::uuid as variant_id,
           (l ->> 'location_id')::uuid as location_id,
           sum((l ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_lines) l
    group by 1, 2
    -- Lock in a consistent order so two check-outs can't deadlock.
    order by 1, 2
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Quantities must be greater than zero' using errcode = 'check_violation';
    end if;

    select i.name into v_name
    from public.item_variants v join public.items i on i.id = v.item_id
    where v.id = v_line.variant_id and (i.checkoutable or p_kit_id is not null);
    if v_name is null then
      raise exception 'One of the items can''t be checked out (mark it as "Can be checked out" first)'
        using errcode = 'check_violation';
    end if;

    v_old := private.lock_stock_level(v_line.variant_id, v_line.location_id);
    if v_old < v_line.quantity then
      raise exception 'Not enough "%" at that location: % available, % requested', v_name, v_old, v_line.quantity
        using errcode = 'check_violation';
    end if;

    perform private.record_stock_change(
      v_line.variant_id, v_line.location_id, v_old, v_old - v_line.quantity, 'checked_out',
      'Check-out #' || v_checkout.number || ' to ' || v_checkout.borrower_name
        || coalesce(' (' || v_checkout.project || ')', ''),
      null, 'checkout', v_checkout.id
    );

    insert into public.checkout_lines (checkout_id, variant_id, location_id, quantity)
    values (v_checkout.id, v_line.variant_id, v_line.location_id, v_line.quantity);
  end loop;

  return v_checkout;
end;
$$;

create function public.checkout_items(
  p_borrower_name text,
  p_due_date      date,
  p_lines         jsonb,
  p_borrower_id   uuid default null,
  p_project       text default null,
  p_notes         text default null
)
returns public.checkouts
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_editor();
  return private.create_checkout(p_borrower_name, p_borrower_id, p_project, p_due_date, p_notes, p_lines, null);
end;
$$;

-- Check out a whole kit. Stock is taken from the locations holding the most
-- of each item, splitting across locations if needed.
create function public.checkout_kit(
  p_kit_id        uuid,
  p_borrower_name text,
  p_due_date      date,
  p_borrower_id   uuid default null,
  p_project       text default null,
  p_notes         text default null
)
returns public.checkouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kit public.kits;
  v_item record;
  v_level record;
  v_remaining integer;
  v_take integer;
  v_lines jsonb := '[]'::jsonb;
  v_short text[] := '{}';
begin
  perform private.assert_editor();

  select * into v_kit from public.kits where id = p_kit_id and archived_at is null;
  if v_kit.id is null then
    raise exception 'Kit not found' using errcode = 'no_data_found';
  end if;

  for v_item in
    select ki.variant_id, ki.quantity, i.name, s.label
    from public.kit_items ki
    join public.item_variants v on v.id = ki.variant_id
    join public.items i on i.id = v.item_id
    left join public.sizes s on s.id = v.size_id
    where ki.kit_id = p_kit_id
  loop
    v_remaining := v_item.quantity;
    for v_level in
      select sl.location_id, sl.quantity
      from public.stock_levels sl
      join public.locations l on l.id = sl.location_id
      where sl.variant_id = v_item.variant_id and sl.quantity > 0 and l.archived_at is null
      order by sl.quantity desc, l.sort_order, l.name
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_level.quantity);
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_item.variant_id, 'location_id', v_level.location_id, 'quantity', v_take);
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      v_short := v_short || (v_item.name || coalesce(' ' || v_item.label, '') || ' (short ' || v_remaining || ')');
    end if;
  end loop;

  if cardinality(v_short) > 0 then
    raise exception 'Not enough stock for this kit: %', array_to_string(v_short, ', ')
      using errcode = 'check_violation';
  end if;

  return private.create_checkout(
    p_borrower_name, p_borrower_id, p_project, p_due_date,
    coalesce(nullif(trim(p_notes), ''), 'Kit: ' || v_kit.name), v_lines, p_kit_id
  );
end;
$$;

-- Check in some or all lines of a check-out.
--   p_lines: [{ "line_id", "good", "damaged", "missing", "note", "location_id" (optional) }]
-- Good and damaged units go back to stock (by default where they came from);
-- missing units don't come back and are counted as losses.
create function public.checkin_items(p_checkout_id uuid, p_lines jsonb)
returns public.checkouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.checkouts;
  v_entry jsonb;
  v_line public.checkout_lines;
  v_good integer;
  v_damaged integer;
  v_missing integer;
  v_back integer;
  v_location uuid;
  v_old integer;
  v_note text;
begin
  perform private.assert_editor();

  select * into v_checkout from public.checkouts where id = p_checkout_id for update;
  if v_checkout.id is null then
    raise exception 'Check-out not found' using errcode = 'no_data_found';
  end if;

  for v_entry in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select * into v_line from public.checkout_lines
    where id = (v_entry ->> 'line_id')::uuid and checkout_id = p_checkout_id
    for update;
    if v_line.id is null then
      raise exception 'Unknown check-out line' using errcode = 'no_data_found';
    end if;

    v_good := coalesce((v_entry ->> 'good')::integer, 0);
    v_damaged := coalesce((v_entry ->> 'damaged')::integer, 0);
    v_missing := coalesce((v_entry ->> 'missing')::integer, 0);
    if v_good < 0 or v_damaged < 0 or v_missing < 0 then
      raise exception 'Amounts can''t be negative' using errcode = 'check_violation';
    end if;
    continue when v_good + v_damaged + v_missing = 0;

    if v_good + v_damaged + v_missing
       > v_line.quantity - v_line.returned_good - v_line.returned_damaged - v_line.missing then
      raise exception 'That''s more than is still checked out' using errcode = 'check_violation';
    end if;

    v_note := nullif(trim(v_entry ->> 'note'), '');
    v_back := v_good + v_damaged;
    if v_back > 0 then
      v_location := coalesce((v_entry ->> 'location_id')::uuid, v_line.location_id);
      v_old := private.lock_stock_level(v_line.variant_id, v_location);
      perform private.record_stock_change(
        v_line.variant_id, v_location, v_old, v_old + v_back, 'checked_in',
        'Check-in #' || v_checkout.number
          || case when v_damaged > 0 then ' — ' || v_damaged || ' damaged' else '' end
          || case when v_missing > 0 then ' — ' || v_missing || ' missing' else '' end
          || coalesce(': ' || v_note, ''),
        null, 'checkout', v_checkout.id
      );
    end if;

    update public.checkout_lines
    set returned_good = returned_good + v_good,
        returned_damaged = returned_damaged + v_damaged,
        missing = missing + v_missing,
        condition_note = coalesce(v_note, condition_note),
        returned_at = now(),
        returned_by = auth.uid()
    where id = v_line.id;
  end loop;

  -- Close the check-out once everything is accounted for.
  update public.checkouts c
  set closed_at = now()
  where c.id = p_checkout_id
    and c.closed_at is null
    and not exists (
      select 1 from public.checkout_lines l
      where l.checkout_id = c.id and l.quantity > l.returned_good + l.returned_damaged + l.missing
    )
  returning * into v_checkout;

  return coalesce(v_checkout, (select c from public.checkouts c where c.id = p_checkout_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Purchase orders: receive what arrived.
--   p_lines: [{ "line_id": uuid, "quantity": int }]
-- -----------------------------------------------------------------------------

create function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_lines             jsonb,
  p_location_id       uuid default null,
  p_update_costs      boolean default false
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders;
  v_entry jsonb;
  v_line public.purchase_order_lines;
  v_qty integer;
  v_location uuid;
  v_old integer;
  v_received_any boolean := false;
begin
  perform private.assert_admin();

  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'Purchase order not found' using errcode = 'no_data_found';
  end if;
  if v_po.status in ('draft', 'cancelled', 'received') then
    raise exception 'Only ordered purchase orders can be received (this one is %)', replace(v_po.status::text, '_', ' ')
      using errcode = 'check_violation';
  end if;

  v_location := coalesce(p_location_id, v_po.destination_location_id);

  for v_entry in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_qty := coalesce((v_entry ->> 'quantity')::integer, 0);
    continue when v_qty = 0;
    if v_qty < 0 then
      raise exception 'Received quantities can''t be negative' using errcode = 'check_violation';
    end if;

    select * into v_line from public.purchase_order_lines
    where id = (v_entry ->> 'line_id')::uuid and purchase_order_id = v_po.id
    for update;
    if v_line.id is null then
      raise exception 'Unknown purchase order line' using errcode = 'no_data_found';
    end if;

    v_old := private.lock_stock_level(v_line.variant_id, v_location);
    perform private.record_stock_change(
      v_line.variant_id, v_location, v_old, v_old + v_qty, 'received',
      'PO #' || v_po.number, null, 'purchase_order', v_po.id
    );

    update public.purchase_order_lines set quantity_received = quantity_received + v_qty where id = v_line.id;
    v_received_any := true;

    if p_update_costs and v_line.unit_cost is not null then
      insert into public.item_costs (item_id, unit_cost)
      select v.item_id, v_line.unit_cost from public.item_variants v where v.id = v_line.variant_id
      on conflict (item_id) do update set unit_cost = excluded.unit_cost;
    end if;
  end loop;

  if not v_received_any then
    raise exception 'Enter at least one quantity received' using errcode = 'check_violation';
  end if;

  update public.purchase_orders po
  set status = case
        when not exists (
          select 1 from public.purchase_order_lines l
          where l.purchase_order_id = po.id and l.quantity_received < l.quantity_ordered
        ) then 'received'::public.po_status
        else 'partially_received'::public.po_status
      end,
      received_at = case
        when not exists (
          select 1 from public.purchase_order_lines l
          where l.purchase_order_id = po.id and l.quantity_received < l.quantity_ordered
        ) then now()
        else received_at
      end
  where po.id = v_po.id
  returning * into v_po;

  return v_po;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audits
-- -----------------------------------------------------------------------------

-- Start counting a location: one line per item/size that has stock there.
create function public.start_audit(p_location_id uuid, p_notes text default null)
returns public.audits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit public.audits;
begin
  perform private.assert_editor();

  if not exists (select 1 from public.locations where id = p_location_id) then
    raise exception 'Unknown location' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.audits where location_id = p_location_id and status = 'in_progress') then
    raise exception 'There is already an audit in progress for this location' using errcode = 'check_violation';
  end if;

  insert into public.audits (location_id, notes) values (p_location_id, nullif(trim(p_notes), ''))
  returning * into v_audit;

  insert into public.audit_lines (audit_id, variant_id, expected_quantity)
  select v_audit.id, sl.variant_id, sl.quantity
  from public.stock_levels sl
  join public.item_variants v on v.id = sl.variant_id
  join public.items i on i.id = v.item_id
  where sl.location_id = p_location_id and sl.quantity > 0 and i.archived_at is null;

  return v_audit;
end;
$$;

-- Record a count. Several people can count the same audit at once; each
-- count is saved on its own line. Items not expected there are added.
create function public.record_audit_count(p_audit_id uuid, p_variant_id uuid, p_counted integer)
returns public.audit_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit public.audits;
  v_line public.audit_lines;
begin
  perform private.assert_editor();

  select * into v_audit from public.audits where id = p_audit_id;
  if v_audit.id is null or v_audit.status <> 'in_progress' then
    raise exception 'This audit is no longer open' using errcode = 'check_violation';
  end if;
  if p_counted is not null and p_counted < 0 then
    raise exception 'Counts can''t be negative' using errcode = 'check_violation';
  end if;

  insert into public.audit_lines (audit_id, variant_id, expected_quantity, counted_quantity, counted_by, counted_at)
  values (
    p_audit_id, p_variant_id,
    coalesce((select quantity from public.stock_levels where variant_id = p_variant_id and location_id = v_audit.location_id), 0),
    p_counted, auth.uid(), now()
  )
  on conflict (audit_id, variant_id) do update
    set counted_quantity = excluded.counted_quantity,
        counted_by = excluded.counted_by,
        counted_at = excluded.counted_at
  returning * into v_line;

  return v_line;
end;
$$;

-- Apply an audit: set each counted item/size to its counted quantity
-- (history reason "audit_correction"). Uncounted lines are left alone.
create function public.apply_audit(p_audit_id uuid)
returns public.audits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit public.audits;
  v_line public.audit_lines;
  v_old integer;
begin
  perform private.assert_admin();

  select * into v_audit from public.audits where id = p_audit_id for update;
  if v_audit.id is null or v_audit.status <> 'in_progress' then
    raise exception 'This audit is no longer open' using errcode = 'check_violation';
  end if;

  for v_line in
    select * from public.audit_lines
    where audit_id = p_audit_id and counted_quantity is not null
    order by variant_id
  loop
    v_old := private.lock_stock_level(v_line.variant_id, v_audit.location_id);
    if v_old <> v_line.counted_quantity then
      perform private.record_stock_change(
        v_line.variant_id, v_audit.location_id, v_old, v_line.counted_quantity, 'audit_correction',
        'Audit #' || v_audit.number, null, 'audit', v_audit.id
      );
    end if;
    update public.audit_lines
    set applied_old_quantity = v_old, applied_new_quantity = v_line.counted_quantity
    where id = v_line.id;
  end loop;

  update public.audits
  set status = 'completed', completed_at = now(), completed_by = auth.uid()
  where id = p_audit_id
  returning * into v_audit;

  return v_audit;
end;
$$;

create function public.cancel_audit(p_audit_id uuid)
returns public.audits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit public.audits;
begin
  perform private.assert_admin();
  update public.audits
  set status = 'cancelled', completed_at = now(), completed_by = auth.uid()
  where id = p_audit_id and status = 'in_progress'
  returning * into v_audit;
  if v_audit.id is null then
    raise exception 'This audit is no longer open' using errcode = 'check_violation';
  end if;
  return v_audit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Low stock: items/sizes at or below their minimum (on-hand quantity).
--   variant_id is null for an item-level minimum.
-- -----------------------------------------------------------------------------

create view public.low_stock
with (security_invoker = true)
as
with on_hand as (
  select v.id as variant_id, v.item_id, coalesce(sum(sl.quantity), 0)::bigint as quantity
  from public.item_variants v
  left join public.stock_levels sl on sl.variant_id = v.id
  group by v.id
)
-- Item-level minimum (applies to the item's total)
select
  i.id as item_id,
  i.name as item_name,
  null::uuid as variant_id,
  null::text as size_label,
  coalesce(sum(oh.quantity), 0)::bigint as on_hand,
  i.min_quantity,
  (i.min_quantity - coalesce(sum(oh.quantity), 0))::bigint as shortfall
from public.items i
left join on_hand oh on oh.item_id = i.id
where i.min_quantity is not null and i.archived_at is null
group by i.id
having coalesce(sum(oh.quantity), 0) <= i.min_quantity
union all
-- Size-level minimums
select
  i.id, i.name, v.id, s.label, oh.quantity, v.min_quantity, (v.min_quantity - oh.quantity)::bigint
from public.item_variants v
join public.items i on i.id = v.item_id
join on_hand oh on oh.variant_id = v.id
left join public.sizes s on s.id = v.size_id
where v.min_quantity is not null and v.archived_at is null and i.archived_at is null
  and oh.quantity <= v.min_quantity;

revoke all on public.low_stock from anon;

-- -----------------------------------------------------------------------------
-- Inventory value (admins only). Includes stock that is checked out.
-- -----------------------------------------------------------------------------

create function public.inventory_value()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin();

  with units as (
    select v.item_id, sl.location_id, sl.quantity::numeric as quantity
    from public.stock_levels sl join public.item_variants v on v.id = sl.variant_id
    union all
    select v.item_id, null, q.quantity::numeric
    from public.checked_out_quantities q join public.item_variants v on v.id = q.variant_id
  ),
  valued as (
    select u.item_id, u.location_id, i.category_id, u.quantity,
           u.quantity * coalesce(c.unit_cost, 0) as cost_value,
           u.quantity * coalesce(c.retail_price, 0) as retail_value
    from units u
    join public.items i on i.id = u.item_id and i.archived_at is null
    left join public.item_costs c on c.item_id = u.item_id
  )
  select jsonb_build_object(
    'total_cost', coalesce((select sum(cost_value) from valued), 0),
    'total_retail', coalesce((select sum(retail_value) from valued), 0),
    'checked_out_cost', coalesce((select sum(cost_value) from valued where location_id is null), 0),
    'items_without_cost', (
      select count(*) from public.items i
      where i.archived_at is null
        and not exists (select 1 from public.item_costs c where c.item_id = i.id and c.unit_cost is not null)
    ),
    'by_location', coalesce((
      select jsonb_agg(row_to_json(x) order by x.cost_value desc)
      from (
        select l.id, l.name, sum(v.quantity) as units, sum(v.cost_value) as cost_value, sum(v.retail_value) as retail_value
        from valued v join public.locations l on l.id = v.location_id
        group by l.id, l.name
      ) x
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(row_to_json(x) order by x.cost_value desc)
      from (
        select c.id, coalesce(c.name, 'Uncategorized') as name, sum(v.quantity) as units,
               sum(v.cost_value) as cost_value, sum(v.retail_value) as retail_value
        from valued v left join public.categories c on c.id = v.category_id
        group by c.id, c.name
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard totals (value only for admins).
-- -----------------------------------------------------------------------------

create function public.dashboard_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'items', (select count(*) from public.items where archived_at is null),
    'units', (
      select coalesce(sum(sl.quantity), 0)
      from public.stock_levels sl
      join public.item_variants v on v.id = sl.variant_id
      join public.items i on i.id = v.item_id and i.archived_at is null
    ),
    'checked_out_units', (select coalesce(sum(quantity), 0) from public.checked_out_quantities),
    'open_checkouts', (select count(*) from public.checkouts where closed_at is null),
    'overdue_checkouts', (
      select count(*) from public.checkouts
      where closed_at is null and due_date < (now() at time zone 'America/Chicago')::date
    ),
    'low_stock', (select count(distinct item_id) from public.low_stock)
  );
$$;

-- -----------------------------------------------------------------------------
-- inventory_items(): now with low stock, check-outs and custom fields.
--   p_field_filters: [{ "id": field id, "op": "eq"|"contains"|"gte"|"lte", "value": ... }]
--   p_sort may also be "field:<field id>".
-- -----------------------------------------------------------------------------

drop function public.inventory_items(text, uuid[], boolean, uuid[], boolean, text, boolean, integer, integer);

create function public.inventory_items(
  p_search        text    default null,
  p_category_ids  uuid[]  default null,
  p_uncategorized boolean default false,
  p_location_ids  uuid[]  default null,
  p_archived      boolean default false,
  p_sort          text    default 'name',
  p_descending    boolean default false,
  p_limit         integer default 60,
  p_offset        integer default 0,
  p_low_stock     boolean default false,
  p_checkoutable  boolean default false,
  p_field_filters jsonb   default '[]'
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
  checked_out    bigint,
  low_stock      boolean,
  checkoutable   boolean,
  last_updated   timestamptz,
  custom_fields  jsonb,
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
      '%' || replace(replace(replace(coalesce(trim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      coalesce(cardinality(p_category_ids), 0) > 0 or p_uncategorized as by_category,
      coalesce(cardinality(p_location_ids), 0) > 0 as by_location,
      case when p_sort like 'field:%' then substr(p_sort, 7) end as sort_field
  ),
  low as (
    select distinct item_id from public.low_stock
  ),
  matched as (
    select i.*
    from public.items i, params
    where (i.archived_at is not null) = p_archived
      and (
        params.search is null
        or i.name ilike params.pattern
        or i.sku ilike params.pattern
        or exists (select 1 from jsonb_each_text(i.custom_fields) f where f.value ilike params.pattern)
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
      and (not p_low_stock or i.id in (select item_id from low))
      and (not p_checkoutable or i.checkoutable)
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_field_filters, '[]'::jsonb)) f
        where not coalesce(
          case f ->> 'op'
            when 'eq' then i.custom_fields -> (f ->> 'id') = f -> 'value'
            when 'contains' then (i.custom_fields ->> (f ->> 'id')) ilike '%' || (f ->> 'value') || '%'
            when 'gte' then
              case when jsonb_typeof(i.custom_fields -> (f ->> 'id')) = 'number'
                then (i.custom_fields ->> (f ->> 'id'))::numeric >= private.try_numeric(f ->> 'value')
                else (i.custom_fields ->> (f ->> 'id')) >= (f ->> 'value') end
            when 'lte' then
              case when jsonb_typeof(i.custom_fields -> (f ->> 'id')) = 'number'
                then (i.custom_fields ->> (f ->> 'id'))::numeric <= private.try_numeric(f ->> 'value')
                else (i.custom_fields ->> (f ->> 'id')) <= (f ->> 'value') end
            else true
          end,
          false
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
      coalesce(out.quantity, 0)::bigint as checked_out,
      m.id in (select item_id from low) as low_stock,
      m.checkoutable,
      greatest(m.updated_at, stock.last_change) as last_updated,
      m.custom_fields,
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
      select sum(q.quantity) as quantity
      from public.checked_out_quantities q
      join public.item_variants v on v.id = q.variant_id
      where v.item_id = m.id
    ) out on true
    left join lateral (
      select jsonb_agg(
               jsonb_build_object('id', v.id, 'label', s.label, 'min_quantity', v.min_quantity)
               order by s.sort_order nulls first, s.label
             ) as variants
      from public.item_variants v
      left join public.sizes s on s.id = v.size_id
      where v.item_id = m.id and v.archived_at is null
    ) variant_list on true
  )
  select s.*, count(*) over () as total_count
  from summarized s
  cross join params
  order by
    case when p_sort = 'quantity' and not p_descending then s.total_quantity end asc,
    case when p_sort = 'quantity' and p_descending then s.total_quantity end desc,
    case when p_sort = 'category' and not p_descending then lower(s.category_name) end asc nulls last,
    case when p_sort = 'category' and p_descending then lower(s.category_name) end desc nulls last,
    case when p_sort = 'updated' and not p_descending then s.last_updated end asc,
    case when p_sort = 'updated' and p_descending then s.last_updated end desc,
    case when params.sort_field is not null and not p_descending
      then private.try_numeric(s.custom_fields ->> params.sort_field) end asc nulls last,
    case when params.sort_field is not null and p_descending
      then private.try_numeric(s.custom_fields ->> params.sort_field) end desc nulls last,
    case when params.sort_field is not null and not p_descending
      then lower(s.custom_fields ->> params.sort_field) end asc nulls last,
    case when params.sort_field is not null and p_descending
      then lower(s.custom_fields ->> params.sort_field) end desc nulls last,
    case when p_sort = 'name' and p_descending then lower(s.name) end desc,
    lower(s.name) asc,
    s.id
  limit least(greatest(p_limit, 1), 5000)
  offset greatest(p_offset, 0);
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.user_role(), private.is_admin(), private.can_edit() to authenticated;
grant execute on function private.try_numeric(text) to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.checkout_items(text, date, jsonb, uuid, text, text)',
    'public.checkout_kit(uuid, text, date, uuid, text, text)',
    'public.checkin_items(uuid, jsonb)',
    'public.receive_purchase_order(uuid, jsonb, uuid, boolean)',
    'public.start_audit(uuid, text)',
    'public.record_audit_count(uuid, uuid, integer)',
    'public.apply_audit(uuid)',
    'public.cancel_audit(uuid)',
    'public.inventory_value()',
    'public.dashboard_summary()',
    'public.inventory_items(text, uuid[], boolean, uuid[], boolean, text, boolean, integer, integer, boolean, boolean, jsonb)',
    'public.set_stock(uuid, uuid, integer, public.stock_reason, text)',
    'public.change_stock(uuid, uuid, integer, public.stock_reason, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
