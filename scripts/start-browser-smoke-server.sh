#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${BROWSER_SMOKE_DB_PATH:-/private/tmp/zlt_browser_smoke.db}"
BACKEND_PORT="${BROWSER_SMOKE_BACKEND_PORT:-4101}"
FRONTEND_PORT="${BROWSER_SMOKE_FRONTEND_PORT:-5173}"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then kill "$FRONTEND_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

rm -f "$DB_PATH"
sqlite3 "$DB_PATH" \
  ".read $ROOT/backend/prisma/migrations/20260424_init/migration.sql" \
	  ".read $ROOT/backend/prisma/migrations/20260622_add_tenant_module_entitlements/migration.sql" \
	  ".read $ROOT/backend/prisma/migrations/20260622_add_tenant_portal_configs/migration.sql" \
	  ".read $ROOT/backend/prisma/migrations/20260622_add_procurement_contract_flows/migration.sql" \
	  ".read $ROOT/backend/prisma/migrations/20260622_add_subcontract_work_team_flows/migration.sql"

cd "$ROOT/backend"
DATABASE_URL="file:$DB_PATH" npx ts-node prisma/seed.ts >/dev/null
DATABASE_URL="file:$DB_PATH" JWT_SECRET="browser-smoke-jwt-secret-change-me" PORT="$BACKEND_PORT" NODE_ENV=test npm run dev >/tmp/zlt-browser-smoke-backend.log 2>&1 &
BACKEND_PID=$!

cd "$ROOT/frontend"
VITE_API_TARGET="http://127.0.0.1:$BACKEND_PORT" npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" >/tmp/zlt-browser-smoke-frontend.log 2>&1 &
FRONTEND_PID=$!

wait
