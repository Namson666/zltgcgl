You are audit_worker for the Superpowers Pro refactor of 资料通工程管理系统.

Scope: Review the current uncommitted S30 WMS return import/export changes.

Please inspect the diff and verify whether there are blockers in:

1. Frontend WMS returns page:
   - Adds a real "导出退库记录" button.
   - Uses the existing /wms/returns/export endpoint through a new API helper.
   - Existing Excel return template download/upload UI still works.
   - Does not restore inventory alert / 库存预警.

2. Backend WMS returns:
   - listReturnOrders now filters isActive=true so soft-deleted return orders are absent from active list and export.
   - Existing deleteReturnOrder soft-delete behavior remains consistent.

3. Tests and evidence:
   - Focused real Chrome test: `BROWSER_SMOKE_DB_PATH=/private/tmp/zlt_browser_smoke_wms_return_import_export.db npx playwright test --config playwright.config.ts -g "import and export wms return records"` passed.
   - Full real Chrome smoke: `bash scripts/browser-smoke.sh` passed 26/26.
   - `bash scripts/verify.sh` passed after adding backend unit coverage, with backend 42 tests and frontend 36 tests.
   - `code-review-graph build --skip-flows && code-review-graph detect-changes` reports risk 0.50 and function-level gaps for listReturnOrders/Returns/handleExportReturns, but these are covered by backend unit + focused/full real Chrome.

Return:
- PASS/WARN/FAIL
- Any blockers
- Any Yellow follow-ups
- Specifically confirm whether inventory alert / 库存预警 was accidentally restored.
