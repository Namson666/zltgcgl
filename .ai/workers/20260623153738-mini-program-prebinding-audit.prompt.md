# Claude audit request: S43 mini-program phone prebinding

You are an independent audit worker for the public-clean-baseline branch.

Scope:
- Review only the current uncommitted diff.
- Focus on default mini-program phone prebinding, tenant/personnel routing correctness, migration safety, and browser coverage.
- Do not modify files.

User/business context:
- The default developer mini-program is shared by companies that do not connect their own mini-program.
- Personnel check-in initially matches by phone.
- If the same phone exists in multiple companies, the system must not silently choose one company. It can either require the user to select a company or use an administrator prebinding.
- S41/S42 already covered conflict rejection, selected-tenant check-in, and tenant-owned appId direct routing.
- Current S43 adds developer-managed phone prebinding so default mini-program check-in can route to a prebound tenant/personnel without requiring user selection every time.

Review files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260623_add_mini_program_phone_bindings/migration.sql`
- `scripts/start-browser-smoke-server.sh`
- `backend/src/modules/developer/routes.ts`
- `backend/src/modules/labor/service.ts`
- `frontend/src/api/index.ts`
- `frontend/src/pages/developer/Integrations.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`

Expected behavior:
1. A developer can create/list/delete default mini-program phone bindings.
2. Binding creation requires an enabled developer default mini-program, an active tenant, and an active personnel matching the tenant and phone.
3. Default mini-program check-in should prefer an enabled binding for the phone and route to the bound tenant/personnel.
4. Stale/invalid bindings must not silently fall back to another tenant.
5. Tenant-owned appId direct routing and selected-tenant routing from prior slices must remain intact.
6. The browser smoke database includes the new migration.
7. Real Chrome coverage should click the developer UI to create a binding and then prove a default app check-in with no tenantId routes to the prebound tenant.

Return:
- PASS if no blocking issues.
- WARN for non-blocking risks/follow-ups.
- FAIL for correctness/security/schema/test blockers.

Include exact file/line references for any concern.
