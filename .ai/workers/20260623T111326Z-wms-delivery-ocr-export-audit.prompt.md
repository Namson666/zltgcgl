# Audit request: WMS delivery order export + OCR upload guard

Please audit the current git diff for the ZLT engineering management system.

Scope:

- Backend WMS delivery order export now uses `getDeliveryOrderExportData`.
- Backend delivery export should reuse the same filter semantics as `listDeliveryOrders` for `tenantId`, `supplierId`, `contractId`, `subProjectId`, `startDate`, and `endDate`.
- Inbound order list filters were adjusted to avoid Prisma SQLite-incompatible `mode: "insensitive"`.
- Frontend WMS Inbound page adds a "导出送货单" button.
- Browser smoke adds a real Chrome test that creates a delivery order through the real API, clicks the new export button, verifies the downloaded file, and exercises OCR upload failure handling with a real file chooser.

Verification already run:

- `npm test -- --run src/modules/wms/service.test.ts` in backend: 17 passed.
- Focused Playwright Chrome: `npx playwright test tests/smoke/browser-smoke.spec.ts --grep "export delivery orders"`: 1 passed.
- `bash scripts/verify.sh`: backend tests 7/53 passed, backend build passed, frontend tests 2/36 passed, frontend build passed.
- `bash scripts/browser-smoke.sh`: 30/30 real Chrome tests passed.
- `code-review-graph build --skip-flows && code-review-graph detect-changes`: risk 0.50; static test gaps are covered by the above unit and browser tests.

Please check for blockers only:

1. Tenant isolation or permission regression.
2. Delivery order export missing filters or leaking data.
3. Frontend button causing wrong export/download behavior.
4. OCR upload guard creating bad data or masking success/failure incorrectly.
5. Accidental restoration of inventory alert / 库存预警, which is explicitly out of scope.

Return PASS if no blocking issue is found. If you find a blocker, describe exact file/function and minimal fix.
