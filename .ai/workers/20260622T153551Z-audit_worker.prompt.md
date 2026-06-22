# audit_worker: remove inventory alerts + labor export fixes

You are an independent Claude CLI audit worker for the public-clean-baseline branch of the ZLT engineering management system.

Audit the current uncommitted diff only. Do not modify files.

Scope:

1. Inventory warning / 库存预警 has been removed as a product feature.
   - It should no longer appear in frontend routes, menus, API client methods, browser smoke route matrices, or public-facing docs.
   - `/api/wms/alerts` should no longer be mounted.
   - Keeping historical Prisma fields/migrations is acceptable if they are not used by product code.

2. Labor export/report fixes are included in the same working diff.
   - Salary export, payment export, and labor report export should download real files from backend endpoints.
   - Backend access controls and tenant/department scoping must not be weakened.
   - Frontend buttons should not be fake success toasts.

Evidence already run by Codex before this worker:

- `bash scripts/verify.sh` passed.
- `bash scripts/browser-smoke.sh` passed 6/6 in real Chrome.

Please return:

- PASS or FAIL.
- Blocking issues, if any.
- Non-blocking risks or follow-ups.
- Specific files/lines when possible.

