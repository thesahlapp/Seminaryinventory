#!/usr/bin/env bash
# Restore a backup made by .github/workflows/backup.yml into an EMPTY Supabase project.
# Usage: scripts/restore-backup.sh <backup-folder> "<session pooler connection string>"
# See docs/BACKUPS.md for the full steps.
set -euo pipefail

dir="${1:?Usage: scripts/restore-backup.sh <backup-folder> <db-url>}"
db="${2:?Usage: scripts/restore-backup.sh <backup-folder> <db-url>}"
for f in schema.sql data.sql; do
  [ -f "$dir/$f" ] || { echo "Missing $dir/$f" >&2; exit 1; }
done

echo "1/4 Restoring tables, functions, security rules and data…"
psql --single-transaction --variable ON_ERROR_STOP=1 --quiet \
  --file "$dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$dir/data.sql" \
  --output /dev/null \
  --dbname "$db"

# A new Supabase project automatically grants signed-out (anon) and signed-in
# users full access to new tables. The dump only records grants that differ from
# Postgres defaults, so take those automatic grants away again and re-apply the
# exact grants from the backup. Row-level security protects the data either way;
# this restores the second layer too.
echo "2/4 Restoring permissions…"
{
  echo "begin;"
  echo "revoke all on all tables in schema public from anon, authenticated;"
  echo "revoke all on all sequences in schema public from anon, authenticated;"
  echo "revoke all on all functions in schema public from public, anon, authenticated;"
  echo "revoke all on all functions in schema private from public, anon, authenticated;"
  grep -E '^(GRANT|REVOKE) ' "$dir/schema.sql" | grep -v ' ON SCHEMA '
  echo "commit;"
} | psql --variable ON_ERROR_STOP=1 --quiet --dbname "$db"

echo "3/4 Restoring the sign-up trigger and photo permissions…"
PGOPTIONS="-c client_min_messages=warning" psql --single-transaction --variable ON_ERROR_STOP=1 --quiet \
  --file "$(dirname "$0")/../supabase/restore/after-restore.sql" --dbname "$db"

echo "4/4 Checking…"
psql --dbname "$db" --tuples-only --command \
  "select format('%s items, %s history rows, %s users', (select count(*) from public.items), (select count(*) from public.stock_movements), (select count(*) from auth.users));"
echo "Done. Next: the steps after restoring in docs/BACKUPS.md."
