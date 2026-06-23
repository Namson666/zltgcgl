Role: audit_worker

Scope: review the WMS material catalog CRUD/export slice.

Changed areas:
- frontend/src/pages/wms/Materials.tsx
- frontend/src/api/index.ts
- frontend/tests/smoke/browser-smoke.spec.ts
- backend/src/modules/wms/service.ts
- backend/src/modules/wms/routes.ts
- backend/src/modules/wms/service.test.ts

Context:
- User requires Superpowers Pro delivery, Claude worker evidence, real Chrome/browser validation, and code-review-graph.
- Inventory alert / 库存预警 has been removed and must not be restored.
- This slice adds a real "物资档案" UI to WMS materials page with create/edit/delete/export.
- The backend material list filter was fixed from Prisma `contains + mode: insensitive` to SQLite-safe `contains` after focused Chrome caught GET `/api/wms/materials?name=...` 500.
- Backend update/delete now find material by `{ id, tenantId }` before mutating to preserve tenant isolation.

Verification already run:
- Focused real Chrome `wms material catalog CRUD and export`: 1/1 passed after backend filter fix and again after tenant-scope fix.
- `bash scripts/verify.sh`: passed; backend 7 files / 40 tests, frontend tests/build passed.
- Full real Chrome `bash scripts/browser-smoke.sh`: 24/24 passed after final tenant-scope fix.
- `code-review-graph build --skip-flows && code-review-graph detect-changes`: risk 0.50. It reports function-level gaps for UI component helpers and material service functions, but this slice has focused/full Chrome UI+API assertions plus direct backend unit tests for list/update/delete tenant safeguards.

Please audit blockers only:
1. Does the UI actually expose material catalog create/edit/delete/export through real clickable controls?
2. Does the browser smoke test prove create/edit/delete/export plus API read-back?
3. Do backend list/update/delete changes preserve tenant isolation and SQLite compatibility?
4. Does anything restore or reference inventory alert / 库存预警?
5. Are there any blocking product/security issues before commit?

Return PASS/WARN/FAIL with concise evidence and required fixes if any.
