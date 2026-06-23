You are an independent Claude CLI audit worker for the ZLT engineering management system.

Scope:
- Review the current uncommitted S31 WMS outbound export/delete-preview slice.
- Focus files:
  - frontend/src/api/index.ts
  - frontend/src/pages/wms/Outbound.tsx
  - frontend/tests/smoke/browser-smoke.spec.ts
  - backend/src/modules/wms/service.ts
  - backend/src/modules/wms/service.test.ts
- Intended behavior:
  - WMS outbound page exposes a "导出出库记录" action.
  - The action downloads a real Excel file and shows success/error toast.
  - Backend outbound export returns active outbound orders only, consistent with list/delete semantics.
  - Browser smoke creates real inbound stock, creates outbound through the UI, downloads outbound PDF, exports outbound records, opens delete cascade preview, confirms stock impact, deletes, and verifies active API list no longer contains the deleted order.
  - Inventory alert / 库存预警 must not be restored in business code, routes, Prisma schema, menus, or acceptance matrix.

Verification already run locally:
- Focused Chrome:
  BROWSER_SMOKE_DB_PATH=/private/tmp/zlt_browser_smoke_wms_outbound_export_delete.db npx playwright test --config playwright.config.ts -g "create export and delete wms outbound records" from frontend/
  Result: 1/1 passed.
- bash scripts/verify.sh
  Result: backend 7 files / 43 tests passed; frontend 2 files / 36 tests passed; backend and frontend builds passed.
- bash scripts/browser-smoke.sh
  Result: real Chrome 27/27 passed.
- code-review-graph build --skip-flows && code-review-graph detect-changes
  Result: graph 137 files / 1592 nodes / 24186 edges, risk 0.50, function-level gaps for getOutboundExportData/Outbound/handleExportOutbound covered by backend unit + focused/full Chrome.

Audit tasks:
1. Check for blockers: permission regressions, inactive/soft-deleted outbound orders leaking into export/list, dead buttons, fake download, brittle API mismatch, or test setup that doesn't prove the UI path.
2. Check whether the new browser test genuinely exercises the real UI create/export/delete-preview flow.
3. Check that no inventory alert functionality was restored.
4. Return PASS/WARN/FAIL with concise evidence and any must-fix blockers.
