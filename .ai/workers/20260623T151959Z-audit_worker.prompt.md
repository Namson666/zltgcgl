# Claude audit request: S42 mini-program selected-tenant check-in

You are an independent audit worker for the public-clean-baseline branch.

Scope:
- Review only the current uncommitted diff.
- Focus on mini-program mobile check-in routing security and regression coverage.
- Do not modify files.

Context:
- User requirement: the developer default mini-program can be shared by companies. Personnel are matched by phone. If a phone exists in multiple companies, the system must not silently route to one company; the user must choose a company or the administrator must prebind. Tenant-owned mini-program appId should route directly to its tenant.
- Previous slice already covered default app conflict returning `MULTIPLE_TENANTS` and tenant-owned appId direct routing.
- Current slice adds selected-tenant handling after a conflict and closes a bypass where `/api/mobile/check-in` with `tenantId` could skip valid appId checks.

Please review:
1. `backend/src/modules/labor/service.ts`
   - `resolveSelectedTenantByMiniProgram`
   - `createMobileCheckIn`
2. `frontend/tests/smoke/browser-smoke.spec.ts`
   - test `mini-program check-in does not silently route duplicated phone and tenant app routes directly`

Expected behavior:
- If `tenantId` is provided to mobile check-in, an `appId` is still required.
- Unknown appId + tenantId must not bypass app config; it should fail.
- Disabled appId must fail.
- Tenant-owned appId with a mismatched tenantId must fail.
- Default appId with selected tenantId should find the personnel in the selected active tenant and write exactly that tenant's check-in.
- Tenant-owned appId without selected tenantId should keep routing directly to its configured tenant.
- Existing per-day check-in limit and attendance sync should remain intact.

Return:
- PASS if no blocking issues.
- WARN with specific risks if coverage is adequate but there are follow-ups.
- FAIL if there is a correctness/security issue that should block commit.

Include exact file/line references for any concern.
