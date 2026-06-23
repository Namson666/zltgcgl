You are audit_worker for the Superpowers Pro refactor of 资料通工程管理系统.

Scope: Review the current uncommitted S29 WMS inbound import/export changes.

Please inspect the diff and verify whether there are blockers in:

1. Frontend WMS inbound page:
   - Adds a real "导出入库记录" button.
   - Excel import sends selected contractId, departmentId, and supplierName.
   - Does not restore inventory alert / 库存预警.

2. Backend WMS inbound Excel import:
   - Route accepts contractId, departmentId, supplierName, deliveryDate/inboundDate.
   - createExcelInbound persists contractId, departmentId, supplierName.
   - Excel import resolves/creates sub-project by department + projectName like manual inbound.
   - Inventory is associated with the resolved subProjectId and departmentId so delete cascade preview can show inventory impact.

3. Tests and evidence:
   - Focused real Chrome test: `BROWSER_SMOKE_DB_PATH=/private/tmp/zlt_browser_smoke_wms_inbound_import_export.db npx playwright test --config playwright.config.ts -g "import and export wms inbound records"` passed.
   - Full real Chrome smoke: `bash scripts/browser-smoke.sh` passed 25/25.
   - `bash scripts/verify.sh` passed after adding backend unit coverage, with backend 41 tests and frontend 36 tests.
   - `code-review-graph build --skip-flows && code-review-graph detect-changes` reports risk 0.50 and function-level gaps for createExcelInbound/Inbound/handleExcelSubmit/handleExportInbound, but these are covered by backend unit + focused/full real Chrome.

Return:
- PASS/WARN/FAIL
- Any blockers
- Any Yellow follow-ups
- Specifically confirm whether inventory alert / 库存预警 was accidentally restored.
