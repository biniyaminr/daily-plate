#!/usr/bin/env bash
# Runs the database tests against a throwaway local PostgreSQL cluster:
# Supabase stub + the real migration, then tests/db/*.test.mjs.
# Needs PostgreSQL 15+ binaries (initdb, pg_ctl, psql) on PATH or in PGBIN.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${PGBIN:-}" ]]; then
  for candidate in "$(dirname "$(command -v pg_ctl 2>/dev/null || echo /x/x)")" /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql@16/bin /usr/lib/postgresql/17/bin; do
    [[ -x "$candidate/pg_ctl" ]] && PGBIN="$candidate" && break
  done
fi
[[ -n "${PGBIN:-}" ]] || { echo "PostgreSQL binaries not found; set PGBIN." >&2; exit 1; }

dir="$(mktemp -d)"
port=54329
cleanup() { "$PGBIN/pg_ctl" -D "$dir/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$dir/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$dir/data" -o "-p $port -k $dir -c listen_addresses=''" -w start >/dev/null

export PGHOST="$dir" PGPORT="$port" PGUSER=postgres PGDATABASE=postgres
"$PGBIN/psql" -v ON_ERROR_STOP=1 -q -f tests/db/supabase-stub.sql
for migration in supabase/migrations/*.sql; do
  "$PGBIN/psql" -v ON_ERROR_STOP=1 -q -f "$migration"
done

node --experimental-strip-types --no-warnings=ExperimentalWarning --test tests/db/*.test.mjs
