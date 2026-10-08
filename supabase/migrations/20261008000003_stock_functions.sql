-- =============================================================================
-- Stock change functions. These are the ONLY way to change quantities.
-- Each one locks the affected stock row(s), updates the quantity and appends a
-- row to stock_movements in the same transaction.
--
-- Called from the app with supabase.rpc('set_stock' | 'change_stock' | 'transfer_stock', ...)
-- =============================================================================

-- Ensure a stock_levels row exists and lock it; returns the current quantity.
create function private.lock_stock_level(p_variant_id uuid, p_location_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_quantity integer;
begin
  insert into public.stock_levels (variant_id, location_id, quantity)
  values (p_variant_id, p_location_id, 0)
  on conflict (variant_id, location_id) do nothing;

  select quantity into v_quantity
  from public.stock_levels
  where variant_id = p_variant_id and location_id = p_location_id
  for update;

  return v_quantity;
end;
$$;

-- Write the new quantity and the matching history row.
create function private.record_stock_change(
  p_variant_id        uuid,
  p_location_id       uuid,
  p_old_quantity      integer,
  p_new_quantity      integer,
  p_reason            public.stock_reason,
  p_note              text,
  p_transfer_group_id uuid default null,
  p_reference_type    text default null,
  p_reference_id      uuid default null
)
returns public.stock_movements
language plpgsql
set search_path = ''
as $$
declare
  v_movement public.stock_movements;
begin
  if p_new_quantity < 0 then
    raise exception 'Not enough stock: % on hand, change would leave %', p_old_quantity, p_new_quantity
      using errcode = 'check_violation';
  end if;

  if p_reason = 'other' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'A note is required when the reason is "Other"'
      using errcode = 'check_violation';
  end if;

  if p_new_quantity = p_old_quantity then
    raise exception 'Quantity is unchanged (%)', p_old_quantity
      using errcode = 'check_violation';
  end if;

  update public.stock_levels
  set quantity = p_new_quantity, updated_at = now()
  where variant_id = p_variant_id and location_id = p_location_id;

  insert into public.stock_movements (
    variant_id, location_id, old_quantity, new_quantity, reason, reason_note,
    changed_by, changed_by_email, transfer_group_id, reference_type, reference_id
  )
  values (
    p_variant_id, p_location_id, p_old_quantity, p_new_quantity, p_reason,
    nullif(trim(p_note), ''),
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    p_transfer_group_id, p_reference_type, p_reference_id
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

create function private.assert_can_edit_stock(p_variant_id uuid, p_location_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.can_edit() then
    raise exception 'You do not have permission to change stock'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.item_variants where id = p_variant_id) then
    raise exception 'Unknown item variant' using errcode = 'foreign_key_violation';
  end if;

  if not exists (select 1 from public.locations where id = p_location_id) then
    raise exception 'Unknown location' using errcode = 'foreign_key_violation';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_stock: set an absolute quantity (e.g. after a physical count).
-- -----------------------------------------------------------------------------

create function public.set_stock(
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

  if p_reason in ('transfer_in', 'transfer_out') then
    raise exception 'Use transfer_stock to move stock between locations'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'Quantity cannot be negative' using errcode = 'check_violation';
  end if;

  v_old := private.lock_stock_level(p_variant_id, p_location_id);

  return private.record_stock_change(
    p_variant_id, p_location_id, v_old, p_new_quantity, p_reason, p_note
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- change_stock: add or remove a number of units (e.g. received +24, issued -3).
-- -----------------------------------------------------------------------------

create function public.change_stock(
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

  if p_reason in ('transfer_in', 'transfer_out') then
    raise exception 'Use transfer_stock to move stock between locations'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'Change amount cannot be zero' using errcode = 'invalid_parameter_value';
  end if;

  v_old := private.lock_stock_level(p_variant_id, p_location_id);

  return private.record_stock_change(
    p_variant_id, p_location_id, v_old, v_old + p_delta, p_reason, p_note
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- transfer_stock: move units between two locations (two linked history rows).
-- -----------------------------------------------------------------------------

create function public.transfer_stock(
  p_variant_id       uuid,
  p_from_location_id uuid,
  p_to_location_id   uuid,
  p_quantity         integer,
  p_note             text default null
)
returns setof public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group    uuid := gen_random_uuid();
  v_from_old integer;
  v_to_old   integer;
begin
  perform private.assert_can_edit_stock(p_variant_id, p_from_location_id);
  perform private.assert_can_edit_stock(p_variant_id, p_to_location_id);

  if p_from_location_id = p_to_location_id then
    raise exception 'Choose two different locations' using errcode = 'invalid_parameter_value';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Lock both rows in a consistent order to avoid deadlocks.
  if p_from_location_id < p_to_location_id then
    v_from_old := private.lock_stock_level(p_variant_id, p_from_location_id);
    v_to_old   := private.lock_stock_level(p_variant_id, p_to_location_id);
  else
    v_to_old   := private.lock_stock_level(p_variant_id, p_to_location_id);
    v_from_old := private.lock_stock_level(p_variant_id, p_from_location_id);
  end if;

  return next private.record_stock_change(
    p_variant_id, p_from_location_id, v_from_old, v_from_old - p_quantity,
    'transfer_out', p_note, v_group
  );
  return next private.record_stock_change(
    p_variant_id, p_to_location_id, v_to_old, v_to_old + p_quantity,
    'transfer_in', p_note, v_group
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions: only signed-in users may call the public functions; the private
-- helpers are callable only from inside these functions and RLS policies.
-- -----------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.user_role(), private.is_admin(), private.can_edit() to authenticated;

revoke all on function public.set_stock(uuid, uuid, integer, public.stock_reason, text) from public, anon;
revoke all on function public.change_stock(uuid, uuid, integer, public.stock_reason, text) from public, anon;
revoke all on function public.transfer_stock(uuid, uuid, uuid, integer, text) from public, anon;

grant execute on function public.set_stock(uuid, uuid, integer, public.stock_reason, text) to authenticated;
grant execute on function public.change_stock(uuid, uuid, integer, public.stock_reason, text) to authenticated;
grant execute on function public.transfer_stock(uuid, uuid, uuid, integer, text) to authenticated;
