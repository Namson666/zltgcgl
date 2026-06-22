#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/docs/smoke-evidence"

cd "$ROOT/frontend"
npx playwright test --config playwright.config.ts
