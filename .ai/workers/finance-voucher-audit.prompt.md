# Claude audit request: finance voucher + petty cash browser flow

Please audit the current git diff for the finance voucher and petty-cash slice in this repository.

Scope:
- backend/src/modules/finance/routes.ts
- backend/src/modules/finance/service.ts
- frontend/src/api/index.ts
- frontend/tests/smoke/browser-smoke.spec.ts

User/product requirements relevant to this slice:
- Finance module must work independently when enabled.
- Real browser tests must exercise actual product paths, not fake unit-only success.
- Finance management needs expense entry, petty cash, attachment/upload, lists, exports over time.
- Public repository: no secrets or private data should be introduced.

What changed:
- Finance expense creation now accepts multipart FormData with an uploaded voucher image/PDF and stores `/uploads/finance-*` in receiptPath.
- Frontend financeApi.createExpense now routes FormData through multipart upload.
- Expense listing now hydrates contract/department display data without changing Prisma schema relations, and exposes receiptUrl from receiptPath.
- Real Chrome smoke test covers petty cash account creation, advance record creation, finance voucher upload, expense API receiptPath assertion, expense list search/detail/edit/delete, and screenshot evidence.

Validation already run:
- Focused real Chrome Playwright test: `npx playwright test --config playwright.config.ts -g "finance petty cash and expense voucher CRUD"` passed.
- `bash scripts/verify.sh` passed.
- Full real Chrome smoke: `bash scripts/browser-smoke.sh` passed 10/10.

Audit questions:
1. Any blocker for tenant isolation or module entitlement boundaries?
2. Any blocker in multipart parsing, file type/size handling, upload path handling, or public repo secret leakage?
3. Any blocker in the expense contract/department hydration approach?
4. Any evidence that the browser test is fake/shallow rather than actually clicking and uploading?
5. Any non-blocking risks we should record as Yellow?

Return PASS/FAIL with blockers first.
