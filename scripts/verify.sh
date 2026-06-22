#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
