#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Backend Prisma generate =="
(
  cd "$ROOT_DIR/backend"
  npm run prisma:generate
)

echo "== Backend test database =="
bash "$ROOT_DIR/scripts/init-sqlite-db.sh" "$ROOT_DIR/backend/prisma/test.db"

echo "== Backend tests =="
(
  cd "$ROOT_DIR/backend"
  npm test
)

echo "== Backend build =="
(
  cd "$ROOT_DIR/backend"
  npm run build
)

echo "== Frontend tests =="
(
  cd "$ROOT_DIR/frontend"
  npm test
)

echo "== Frontend build =="
(
  cd "$ROOT_DIR/frontend"
  npm run build
)

echo "== Verify complete =="
