# audit_worker: Phase 3 Contract Attachments Slice Review

You are an independent Claude CLI audit worker. Review the current uncommitted diff after commit `0a2c1f8`.

Scope:
- Contract management is a default base feature and should not depend on tenant module entitlements for labor/wms/finance.
- This slice adds contract-owned attachment list/upload/download/delete APIs under `/api/contracts/attachments...`.
- Frontend contract details should use `contractApi` for attachments, not `laborApi`.
- Download should be authenticated and tenant-scoped.
- Real Chrome smoke was expanded to create a contract, upload a fixture file, download it, delete the attachment, then delete the test contract.

Please inspect:
- `backend/src/modules/contract/routes.ts`
- `backend/src/modules/contract/service.ts`
- `frontend/src/api/index.ts`
- `frontend/src/pages/contracts/List.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`
- relevant git diff

Return:
1. PASS/FAIL for blocking issues.
2. Tenant isolation or file access/security concerns.
3. Any remaining labor module coupling for contract attachments.
4. Any fake-completion or acceptance evidence gaps.
5. Concrete file/line suggestions if fixes are needed.

Do not modify files. This is an audit only.
