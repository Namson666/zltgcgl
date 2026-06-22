# audit_worker: Phase 3 Contract Tabs Foundation Review

You are an independent Claude CLI audit worker. Review the current uncommitted diff for Phase 3 of a construction management system refactor.

Scope:
- Contract management is a default base feature and must not depend on tenant module entitlements for wms/labor/finance.
- The frontend contract page now has three tabs: construction contracts, procurement contracts, subcontract contracts.
- Subcontract contract listing should go through `/api/contracts/sub-contracts`, not `/api/labor/sub-contract`, because labor may be disabled.
- Express route ordering must not let `/:id` catch `/sub-contracts`.
- Current slice is only tab/list foundation. Do not treat it as full Phase 3/Product Green.

Please inspect:
- `backend/src/modules/contract/routes.ts`
- `backend/src/modules/contract/service.ts`
- `frontend/src/api/index.ts`
- `frontend/src/pages/contracts/List.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`
- relevant git diff

Return:
1. PASS/FAIL for blocking issues.
2. Any security/tenant isolation concerns.
3. Any module-entitlement coupling concerns.
4. Any fake-completion or acceptance evidence gaps.
5. Concrete file/line suggestions if fixes are needed.

Do not modify files. This is an audit only.
