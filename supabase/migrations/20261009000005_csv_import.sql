-- =============================================================================
-- Bulk quantity import (used by CSV import, admins only). Sets each
-- item/size at a location to the given quantity in one call; every change is
-- still logged in stock_movements ("Initial count" the first time, otherwise
-- "Count correction"), with the note "CSV import".
--   p_changes: [{ "variant_id": uuid, "location_id": uuid, "quantity": int }]
-- Returns how many quantities actually changed.
-- =============================================================================

create function public.import_stock_levels(p_changes jsonb, p_note text default 'CSV import')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change record;
  v_old integer;
  v_count integer := 0;
begin
  perform private.assert_admin();

  for v_change in
    select (c ->> 'variant_id')::uuid as variant_id,
           (c ->> 'location_id')::uuid as location_id,
           (c ->> 'quantity')::integer as quantity
    from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) c
    order by 1, 2
  loop
    if v_change.quantity is null or v_change.quantity < 0 then
      raise exception 'Quantities must be 0 or more' using errcode = 'check_violation';
    end if;

    v_old := private.lock_stock_level(v_change.variant_id, v_change.location_id);
    continue when v_old = v_change.quantity;

    perform private.record_stock_change(
      v_change.variant_id, v_change.location_id, v_old, v_change.quantity,
      case
        when exists (
          select 1 from public.stock_movements m
          where m.variant_id = v_change.variant_id and m.location_id = v_change.location_id
        ) then 'count_correction'::public.stock_reason
        else 'initial_count'::public.stock_reason
      end,
      p_note
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.import_stock_levels(jsonb, text) from public, anon;
grant execute on function public.import_stock_levels(jsonb, text) to authenticated;
