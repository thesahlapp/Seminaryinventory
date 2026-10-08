-- =============================================================================
-- Reports (admins only). Dates are Dallas time (America/Chicago).
-- =============================================================================

-- Units going out (issued, checked out) and coming in (received, returned,
-- checked in) per day/week/month, grouped by item, category or location.
create function public.report_usage(
  p_from   date,
  p_to     date,
  p_group  text default 'category',
  p_bucket text default 'week'
)
returns table (bucket date, group_id uuid, group_name text, units_out bigint, units_in bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if p_group not in ('item', 'category', 'location') or p_bucket not in ('day', 'week', 'month') then
    raise exception 'Unknown grouping' using errcode = 'invalid_parameter_value';
  end if;

  return query
  select
    date_trunc(p_bucket, m.changed_at at time zone 'America/Chicago')::date,
    case p_group when 'item' then i.id when 'category' then i.category_id else m.location_id end,
    case p_group when 'item' then i.name when 'category' then coalesce(c.name, 'Uncategorized') else l.name end,
    coalesce(sum(-m.delta) filter (where m.reason in ('issued', 'checked_out')), 0)::bigint,
    coalesce(sum(m.delta) filter (where m.reason in ('received', 'returned', 'checked_in')), 0)::bigint
  from public.stock_movements m
  join public.item_variants v on v.id = m.variant_id
  join public.items i on i.id = v.item_id
  join public.locations l on l.id = m.location_id
  left join public.categories c on c.id = i.category_id
  where (m.changed_at at time zone 'America/Chicago')::date between p_from and p_to
  group by 1, 2, 3
  order by 1, 3;
end;
$$;

-- Units out per item in the period, including items that didn't move.
create function public.report_movers(p_from date, p_to date)
returns table (item_id uuid, item_name text, category_name text, units_out bigint, movements bigint, on_hand bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();

  return query
  select
    i.id,
    i.name,
    c.name,
    coalesce(mv.units_out, 0)::bigint,
    coalesce(mv.movements, 0)::bigint,
    coalesce((
      select sum(sl.quantity) from public.stock_levels sl
      join public.item_variants v on v.id = sl.variant_id
      where v.item_id = i.id
    ), 0)::bigint
  from public.items i
  left join public.categories c on c.id = i.category_id
  left join lateral (
    select
      sum(-m.delta) filter (where m.reason in ('issued', 'checked_out')) as units_out,
      count(*) as movements
    from public.stock_movements m
    join public.item_variants v on v.id = m.variant_id
    where v.item_id = i.id
      and (m.changed_at at time zone 'America/Chicago')::date between p_from and p_to
  ) mv on true
  where i.archived_at is null;
end;
$$;

-- Losses: damaged, lost, and stock-count corrections, with value at unit cost.
create function public.report_losses(p_from date, p_to date)
returns table (item_id uuid, item_name text, size_label text, kind text, units bigint, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();

  return query
  with events as (
    -- From the stock history
    select m.variant_id,
           case
             when m.reason = 'damaged' then 'damaged'
             when m.reason = 'lost' then 'lost'
             when m.delta < 0 then 'correction_loss'
             else 'correction_gain'
           end as kind,
           abs(m.delta) as units
    from public.stock_movements m
    where m.reason in ('damaged', 'lost', 'count_correction', 'audit_correction')
      and (m.changed_at at time zone 'America/Chicago')::date between p_from and p_to
    union all
    -- From check-ins: damaged on return, or never returned
    select cl.variant_id, 'damaged', cl.returned_damaged
    from public.checkout_lines cl
    where cl.returned_damaged > 0
      and (cl.returned_at at time zone 'America/Chicago')::date between p_from and p_to
    union all
    select cl.variant_id, 'lost', cl.missing
    from public.checkout_lines cl
    where cl.missing > 0
      and (cl.returned_at at time zone 'America/Chicago')::date between p_from and p_to
  )
  select i.id, i.name, s.label, e.kind, sum(e.units)::bigint, sum(e.units * coalesce(ic.unit_cost, 0))
  from events e
  join public.item_variants v on v.id = e.variant_id
  join public.items i on i.id = v.item_id
  left join public.sizes s on s.id = v.size_id
  left join public.item_costs ic on ic.item_id = i.id
  group by i.id, i.name, s.label, e.kind
  order by 6 desc, 5 desc;
end;
$$;

-- Value of stock on hand at the end of each day, rebuilt from the history
-- using today's unit costs.
create function public.report_value_over_time(p_from date, p_to date)
returns table (day date, units bigint, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if p_to - p_from > 731 then
    raise exception 'Choose a range of two years or less' using errcode = 'invalid_parameter_value';
  end if;

  return query
  with costs as (
    select v.id as variant_id, coalesce(c.unit_cost, 0) as cost
    from public.item_variants v
    left join public.item_costs c on c.item_id = v.item_id
  ),
  now_total as (
    select coalesce(sum(sl.quantity), 0) as units, coalesce(sum(sl.quantity * k.cost), 0) as value
    from public.stock_levels sl join costs k on k.variant_id = sl.variant_id
  ),
  daily as (
    select (m.changed_at at time zone 'America/Chicago')::date as d,
           sum(m.delta) as du,
           sum(m.delta * k.cost) as dv
    from public.stock_movements m join costs k on k.variant_id = m.variant_id
    where (m.changed_at at time zone 'America/Chicago')::date > p_from
    group by 1
  )
  select days.d::date,
         (now_total.units - coalesce((select sum(du) from daily where daily.d > days.d), 0))::bigint,
         now_total.value - coalesce((select sum(dv) from daily where daily.d > days.d), 0)
  from generate_series(p_from, p_to, interval '1 day') as days(d), now_total
  order by 1;
end;
$$;

-- Check-out stats: most borrowed items and overdue history.
create function public.report_checkouts(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
begin
  perform private.assert_admin();

  return jsonb_build_object(
    'most_borrowed', coalesce((
      select jsonb_agg(row_to_json(x) order by x.times desc, x.units desc)
      from (
        select i.id as item_id, i.name, count(distinct c.id) as times, sum(cl.quantity) as units
        from public.checkout_lines cl
        join public.checkouts c on c.id = cl.checkout_id
        join public.item_variants v on v.id = cl.variant_id
        join public.items i on i.id = v.item_id
        where (c.created_at at time zone 'America/Chicago')::date between p_from and p_to
        group by i.id, i.name
        order by 3 desc, 4 desc
        limit 25
      ) x
    ), '[]'::jsonb),
    'overdue', coalesce((
      select jsonb_agg(row_to_json(x) order by x.days_late desc)
      from (
        select c.id, c.number, c.borrower_name, c.project, c.due_date, c.closed_at,
               c.closed_at is null as still_out,
               (coalesce((c.closed_at at time zone 'America/Chicago')::date, v_today) - c.due_date) as days_late
        from public.checkouts c
        where (c.created_at at time zone 'America/Chicago')::date between p_from and p_to
          and coalesce((c.closed_at at time zone 'America/Chicago')::date, v_today) > c.due_date
      ) x
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'checkouts', count(*),
        'returned_late', count(*) filter (where closed_at is not null
          and (closed_at at time zone 'America/Chicago')::date > due_date),
        'still_overdue', count(*) filter (where closed_at is null and due_date < v_today)
      )
      from public.checkouts c
      where (c.created_at at time zone 'America/Chicago')::date between p_from and p_to
    )
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.report_usage(date, date, text, text)',
    'public.report_movers(date, date)',
    'public.report_losses(date, date)',
    'public.report_value_over_time(date, date)',
    'public.report_checkouts(date, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Indexes for history-heavy pages and reports
-- -----------------------------------------------------------------------------

create index if not exists stock_movements_reason_changed_at_idx on public.stock_movements (reason, changed_at desc);
create index if not exists stock_movements_variant_changed_at_idx on public.stock_movements (variant_id, changed_at desc);
