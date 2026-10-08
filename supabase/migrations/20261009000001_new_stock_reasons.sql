-- =============================================================================
-- New history reasons. Kept in their own migration because Postgres can't use
-- a new enum value in the same transaction that adds it.
-- =============================================================================

alter type public.stock_reason add value if not exists 'checked_out';
alter type public.stock_reason add value if not exists 'checked_in';
alter type public.stock_reason add value if not exists 'audit_correction';
