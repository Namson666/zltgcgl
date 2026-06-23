# Claude audit request: developer tenant CRUD/user/recycle-bin regression

Please independently review the current git diff for the developer tenant management slice.

Scope:
- `backend/src/modules/developer/service.ts`
- `backend/src/modules/developer/routes.ts`
- `frontend/src/api/index.ts`
- `frontend/src/pages/developer/Tenants.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`

Questions:
1. Does the developer tenant UI call developer-scoped APIs for tenant users/roles/password reset instead of current-tenant APIs?
2. Does tenant user creation pass a tenant role id as required by the backend?
3. Does recycle-bin restore/permanent-delete avoid React callback updater mistakes?
4. Is permanent tenant deletion reasonably safe for the current schema constraints and newly created test tenants?
5. Are there obvious missing authorization/module-entitlement problems, dead buttons, fake tests, or hardcoded test shortcuts?

Evidence already run by Codex:
- `bash scripts/verify.sh` passed: backend 53 tests, frontend 36 tests, backend build, frontend build.
- `bash scripts/browser-smoke.sh` passed: Chrome 31/31.
- Focused Playwright test `developer can manage tenant CRUD users passwords and recycle bin` passed.
- `code-review-graph build --skip-flows && code-review-graph detect-changes` completed with risk score 0.50.

Please return concise findings. Mark any blocking issue as BLOCKER; otherwise say NO BLOCKERS and list non-blocking suggestions.
