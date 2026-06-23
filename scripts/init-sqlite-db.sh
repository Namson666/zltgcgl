#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${1:?usage: scripts/init-sqlite-db.sh <sqlite-db-path>}"

mkdir -p "$(dirname "$DB_PATH")"
rm -f "$DB_PATH"

sqlite3 "$DB_PATH" \
  ".read $ROOT/backend/prisma/migrations/20260424_init/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260622_add_tenant_module_entitlements/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260622_add_tenant_portal_configs/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260622_add_procurement_contract_flows/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260622_add_subcontract_work_team_flows/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260622_add_mobile_check_in_foundation/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260623_add_labor_payment_bank_account/migration.sql" \
  ".read $ROOT/backend/prisma/migrations/20260623_add_mini_program_phone_bindings/migration.sql"
