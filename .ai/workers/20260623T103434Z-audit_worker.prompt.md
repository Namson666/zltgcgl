You are an independent Claude CLI audit worker for the ZLT engineering management system.

Scope:
- Review the current uncommitted S32 WMS transfer export/delete-preview slice.
- Focus files:
  - backend/src/modules/wms/service.ts
  - backend/src/modules/wms/service.test.ts
  - frontend/src/api/index.ts
  - frontend/src/pages/wms/Transfers.tsx
  - frontend/tests/smoke/browser-smoke.spec.ts

Intended behavior:
- WMS transfer page exposes a "导出调拨记录" action that downloads a real Excel file.
- Transfer list/export only return active transfer orders.
- Department-scoped transfers created by the UI persist fromDepartmentId/toDepartmentId on TransferOrder.
- Transfer list/detail/export display department fallback when no sub-project is attached.
- Transfer cascade preview and delete rollback work for department-scoped transfers as well as sub-project transfers.
- Real browser smoke creates inbound stock, creates transfer through UI, downloads transfer PDF, exports transfer records, opens delete cascade preview, verifies inventory impact, deletes, and verifies the active API list no longer contains the deleted transfer.
- Inventory alert / 库存预警 must not be restored.

Verification already run locally:
- Focused Chrome:
  cd frontend && BROWSER_SMOKE_DB_PATH=/private/tmp/zlt_browser_smoke_wms_transfer_export_delete.db npx playwright test --config playwright.config.ts -g "create export and delete wms transfer records"
  Result: 1/1 passed.
- bash scripts/verify.sh
  Result: backend 7 files / 46 tests passed; frontend 2 files / 36 tests passed; backend and frontend builds passed.
- bash scripts/browser-smoke.sh
  Result: real Chrome 28/28 passed.
- code-review-graph build --skip-flows && code-review-graph detect-changes
  Result: graph 137 files / 1597 nodes / 24493 edges, risk 0.50; function-level gaps are covered by backend unit tests plus focused/full Chrome.

Audit tasks:
1. Check for blockers: transfer permission regression, inactive/soft-deleted transfers leaking into list/export, department-scoped transfer IDs not persisted, inventory rollback/preview mismatch, dead export button, fake download, brittle API mismatch, or test setup that does not prove the UI path.
2. Check whether the browser test genuinely exercises real UI create/export/PDF/delete-preview/delete.
3. Check that no inventory alert functionality was restored in business code, routes, Prisma schema, menus, or acceptance matrix.
4. Return PASS/WARN/FAIL with concise evidence and any must-fix blockers.
