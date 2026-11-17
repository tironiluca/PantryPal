#!/usr/bin/env bash
# Applies the Supabase migrations to throwaway databases on a plain PostgreSQL server and runs
# the SQL behaviour tests against them. Connection comes from the standard PG* variables
# (PGHOST, PGPORT, PGUSER, PGPASSWORD); the user needs CREATEDB and superuser-like rights.
#
# Two schema starting points are checked, because the live project may have been created from either:
#   migrations - supabase/migrations/001-003 (TEXT user ids)
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

run_variant legacy supabase/tests/fixtures/legacy_setup_schema.sql
