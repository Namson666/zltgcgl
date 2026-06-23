You are the independent Superpowers Pro Claude CLI audit_worker for S51 on the public-clean-baseline branch.

Audit scope:
- Backend developer production-readiness endpoint:
  - `backend/src/modules/developer/service.ts` `readinessQuery` and `getProductionReadiness`.
  - `backend/src/modules/developer/routes.ts` `GET /api/developer/readiness`.
- Frontend developer API wrapper, route/menu entry, and new `ProductionReadiness` page.
- Real Chrome smoke additions in `frontend/tests/smoke/browser-smoke.spec.ts`.

Intent:
- Add a read-only developer-only production readiness self-check that makes remaining Product Green external gaps visible:
  - database migration/table availability;
  - active tenants;
  - module entitlement records;
  - enabled independent-login portal domains;
  - default/tenant mini-program routing config;
  - HTTP face-recognition gateway readiness.
- It must not mutate data.
- It must not leak endpoint URLs or API keys/secrets.
- It must not claim production DNS/certificates or real third-party credentials are complete; it should surface missing external config as warning.
- It must not reintroduce WMS inventory alert / 库存预警.

Validation evidence already run:
- `cd backend && npm test -- --run src/__tests__/auth.test.ts` passed 13/13.
- Focused real Chrome `developer can manage integrations security monitoring and logs` passed 1/1 with readiness API/UI assertions and enterprise 403.
- `bash scripts/verify.sh` passed backend Prisma generate, backend 8 files / 61 tests, backend build, frontend 3 files / 38 tests, frontend build.
- `bash scripts/browser-smoke.sh` passed full real Chrome 36/36, including developer route matrix with `/dev/readiness`.
- `code-review-graph build --skip-flows && code-review-graph detect-changes` reported risk 0.60 and gaps for `readinessQuery`, `getProductionReadiness`, and `App`; judge against the backend integration test, focused Chrome, and full Chrome evidence above.

Review blockers only:
1. Any auth/permission issue allowing enterprise/anonymous users to read developer readiness.
2. Any secret/endpoint leakage.
3. Any false green/Product Green claim when production DNS/certs or real third-party face gateway credentials are absent.
4. Any database-migration missing-table handling that hides a real issue instead of surfacing warning.
5. Any accidental inventory-alert/prewarning restoration.

Return PASS or BLOCKED, with exact file/line for blockers and non-blocking notes separately.
