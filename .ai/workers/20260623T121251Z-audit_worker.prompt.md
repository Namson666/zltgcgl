# Claude audit request: enterprise main dashboard real summary

Please independently review the current git diff for the enterprise main dashboard summary hardening.

Scope:
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/api/index.ts`
- `frontend/tests/smoke/browser-smoke.spec.ts`

Questions:
1. Does the dashboard now unwrap the different backend response shapes correctly (`pagination.total`, `meta.total`, `data.total`, salary summary data, anomaly summary data)?
2. Is the previous fake monthly attendance display (`new Date().getDate()`) replaced with real attendance monthly summary data?
3. Is `laborApi.getMonthlySummary` pointed at the actual backend route?
4. Does the Playwright test compare UI values with real API values instead of hardcoding fake expectations?
5. Any blockers, accidental inventory-alert restoration, or obvious regressions?

Evidence already run by Codex:
- Backend build passed.
- Frontend build passed.
- Focused Chrome `main dashboard real summary` passed.
- `bash scripts/verify.sh` passed: backend 53 tests, frontend 36 tests, backend build, frontend build.
- `bash scripts/browser-smoke.sh` passed: Chrome 32/32.
- `code-review-graph build --skip-flows && code-review-graph detect-changes` completed with risk score 0.50.

Please return concise findings. Mark any blocking issue as BLOCKER; otherwise say NO BLOCKERS and list non-blocking suggestions.
