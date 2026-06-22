# Claude audit request: admin CRUD + inventory alert removal

You are the independent `audit_worker` for a Superpowers Pro delivery pass.

Please review the current git diff in this repository and report PASS / FAIL with blockers.

Scope to audit:

1. Inventory alert removal
   - User explicitly requested deleting the inventory alert / 库存预警 feature.
   - Verify the current diff does not accidentally remove unrelated labor risk warnings or face threshold logic.
   - Verify remaining references are only historical/status notes, not active feature requirements, menu entries, routes, or browser acceptance scope.

2. Basic admin CRUD browser coverage
   - New real Chrome smoke coverage should exercise roles, users, departments, subprojects, member add/remove, and department enable/disable.
   - Verify the test is not a fake assertion and does not rely only on unit tests.

3. Department and user integration fixes
   - Check that tenant user create/update maps `realName` to backend `name` safely.
   - Check that department detail/users parsing handles backend `{ success, data }`, `users`, and string UUID IDs.
   - Check that operation log `detail` serialization matches Prisma `String?` and does not store unsafe raw objects.

4. Risks
   - Call out any tenant isolation, permission, module entitlement, data loss, or public-repo secret concerns introduced by the diff.

Known verification already run before this audit:

- `bash scripts/verify.sh` passed.
- `bash scripts/browser-smoke.sh` passed 8/8 in system Google Chrome.

Return:

- `PASS` if there are no blocking issues.
- `FAIL` if a blocker exists, with exact file/line and suggested fix.
