#!/usr/bin/env bash
# Applies the Supabase migrations to throwaway databases on a plain PostgreSQL server and runs
# the SQL behaviour tests against them. Connection comes from the standard PG* variables
# (PGHOST, PGPORT, PGUSER, PGPASSWORD); the user needs CREATEDB and superuser-like rights.
#
# Three schema starting points are checked, because the live project may have been created from any:
#   migrations - supabase/migrations/001-003 as historically applied (TEXT user ids)
#   fresh      - the documented new-project path: 001, 002, 004 (no 003)
#   legacy     - the schema from the former SUPABASE_SETUP.md (UUID user ids)
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

run_variant() {
  local name="$1"; shift
  local db="pantrypal_sql_test_${name}"
  echo "== ${name} =="
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${db}" -c "CREATE DATABASE ${db}"
  "${PSQL[@]}" -d "${db}" -f supabase/tests/supabase_shim.sql
  for file in "$@"; do
    "${PSQL[@]}" -d "${db}" -f "${file}"
  done
  # Applying 004 twice proves it is idempotent.
  "${PSQL[@]}" -d "${db}" -f supabase/migrations/004_household_rpcs_and_account_deletion.sql
  "${PSQL[@]}" -d "${db}" -f supabase/migrations/004_household_rpcs_and_account_deletion.sql
  "${PSQL[@]}" -d "${db}" -f supabase/tests/004_household_and_account.test.sql 2>&1 | grep -E 'ok - |All |ERROR|FAILED|CONTEXT|LINE' | sed 's/^psql:[^ ]* NOTICE:  /  /; s/^NOTICE:  /  /'
  "${PSQL[@]}" -d postgres -c "DROP DATABASE ${db}"
}

run_variant migrations \
  supabase/migrations/001_initial_schema.sql \
  supabase/migrations/001_initial_schema.sql \
  supabase/migrations/002_family_sharing.sql \
  supabase/tests/fixtures/users_table.sql \
  supabase/migrations/003_fix_rls.sql

# New project following SUPABASE_SETUP.md: 001 and 002, then 004 (003 is skipped).
run_variant fresh \
  supabase/migrations/001_initial_schema.sql \
  supabase/migrations/002_family_sharing.sql

run_variant legacy supabase/tests/fixtures/legacy_setup_schema.sql
