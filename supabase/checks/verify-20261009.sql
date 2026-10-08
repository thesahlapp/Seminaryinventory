-- Checks that migrations 20261009000001 to 20261009000005 are fully applied.
-- Paste into the Supabase SQL Editor and Run. Every row should say OK.
with expected(migration, kind, name) as (values
  ('000001', 'enum value', 'checked_out'),
  ('000001', 'enum value', 'checked_in'),
  ('000001', 'enum value', 'audit_correction'),
  ('000002', 'column', 'items.min_quantity'),
  ('000002', 'column', 'items.checkoutable'),
  ('000002', 'column', 'item_variants.min_quantity'),
  ('000002', 'column', 'profiles.theme'),
  ('000002', 'column', 'profiles.email_mentions'),
  ('000002', 'column', 'item_photos.caption'),
  ('000002', 'table', 'item_costs'),
  ('000002', 'table', 'category_fields'),
  ('000002', 'table', 'kits'),
  ('000002', 'table', 'kit_items'),
  ('000002', 'table', 'checkouts'),
  ('000002', 'table', 'checkout_lines'),
  ('000002', 'table', 'suppliers'),
  ('000002', 'table', 'purchase_orders'),
  ('000002', 'table', 'purchase_order_lines'),
  ('000002', 'table', 'audits'),
  ('000002', 'table', 'audit_lines'),
  ('000002', 'table', 'item_comments'),
  ('000002', 'table', 'notifications'),
  ('000002', 'profile settings permission', 'profiles.theme'),
  ('000003', 'function', 'private.try_numeric'),
  ('000003', 'function', 'private.create_checkout'),
  ('000003', 'function', 'public.checkout_items'),
  ('000003', 'function', 'public.checkout_kit'),
  ('000003', 'function', 'public.checkin_items'),
  ('000003', 'function', 'public.receive_purchase_order'),
  ('000003', 'function', 'public.start_audit'),
  ('000003', 'function', 'public.record_audit_count'),
  ('000003', 'function', 'public.apply_audit'),
  ('000003', 'function', 'public.cancel_audit'),
  ('000003', 'function', 'public.inventory_value'),
  ('000003', 'function', 'public.dashboard_summary'),
  ('000003', 'new inventory_items', 'public.inventory_items'),
  ('000003', 'view', 'low_stock'),
  ('000003', 'view', 'checked_out_quantities'),
  ('000003', 'signed-in users can run', 'public.apply_audit'),
  ('000004', 'function', 'public.report_usage'),
  ('000004', 'function', 'public.report_movers'),
  ('000004', 'function', 'public.report_losses'),
  ('000004', 'function', 'public.report_value_over_time'),
  ('000004', 'function', 'public.report_checkouts'),
  ('000004', 'index', 'stock_movements_reason_changed_at_idx'),
  ('000004', 'index', 'stock_movements_variant_changed_at_idx'),
  ('000005', 'function', 'public.import_stock_levels'),
  ('000005', 'signed-in users can run', 'public.import_stock_levels')
)
select migration, kind, name,
  case when case kind
    when 'enum value' then exists (select 1 from pg_enum where enumtypid = 'public.stock_reason'::regtype and enumlabel = name)
    when 'column' then exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = split_part(name, '.', 1) and column_name = split_part(name, '.', 2))
    when 'table' then to_regclass('public.' || name) is not null
    when 'view' then to_regclass('public.' || name) is not null
    when 'index' then to_regclass('public.' || name) is not null
    when 'function' then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname || '.' || p.proname = name)
    when 'new inventory_items' then exists (select 1 from pg_proc where proname = 'inventory_items' and 'p_low_stock' = any(proargnames))
    when 'signed-in users can run' then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname || '.' || p.proname = name and has_function_privilege('authenticated', p.oid, 'execute'))
    when 'profile settings permission' then has_column_privilege('authenticated', 'public.profiles', 'theme', 'UPDATE')
  end then 'OK' else 'MISSING' end as status
from expected
order by status desc, migration;
