You are an independent audit_worker for the ZLT engineering management system.

Scope: review the current uncommitted S47 change for labor report export type correctness.

Context:
- User requires Superpowers Pro delivery, real browser evidence, Claude CLI audit, code-review-graph.
- Product issue: /labor/reports lets user choose report type, preview uses selected type, but backend /api/labor/reports/export previously ignored `type` and always generated a multi-sheet labor workbook. Frontend named the downloaded file after the selected type, so filename and workbook content could disagree.
- Current intended behavior:
  1. GET /api/labor/reports/export?months=YYYY-MM&type=payment exports a workbook with only sheet `工资发放明细表`.
  2. type=attendance exports only `月度考勤汇总表`.
  3. Unknown type returns 400 INVALID_REPORT_TYPE.
  4. Missing type remains backward compatible: old all-report multi-sheet export still works.
  5. Auth and canManageReport permission remain unchanged.
  6. Playwright real Chrome test parses the downloaded/API xlsx workbook sheet names using backend ExcelJS and verifies payment + attendance.

Please inspect:
- backend/src/modules/labor/routes.ts
- frontend/tests/smoke/browser-smoke.spec.ts
- frontend/src/pages/labor/Reports.tsx and frontend/src/api/index.ts only if needed

Also consider evidence already run locally:
- focused Chrome: `cd frontend && npx playwright test tests/smoke/browser-smoke.spec.ts --grep "enterprise user can download labor salary payment and report exports"` passed 1/1.
- `bash scripts/verify.sh` passed backend 57 tests/build and frontend 36 tests/build.
- `bash scripts/browser-smoke.sh` passed real Chrome 35/35.
- `code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.50; only test gap was workbookSheetNames helper, executed by real Chrome.

Return a concise audit with:
- PASS/WARN/FAIL
- blockers, if any
- yellow risks or follow-ups
- whether the acceptance behavior above is actually implemented and covered.
