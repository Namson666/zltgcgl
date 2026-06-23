Role: audit_worker

Scope: review the contract progress-payment browser coverage slice.

Changes to inspect:
- frontend/tests/smoke/browser-smoke.spec.ts

Context:
- The user requires Superpowers Pro delivery discipline, Claude CLI audit evidence, and real Chrome/browser validation before delivery.
- Inventory alert / 库存预警 has been removed from product scope and must not be restored.
- This slice only adds real Chrome coverage to the existing contract management flow:
  - create a construction contract
  - open the same contract detail dialog
  - create a construction progress payment / receipt record
  - assert success toast, amount, and description on the same detail page
  - continue existing contract attachment upload/download/delete, procurement payment/invoice/voucher, subcontract payment/voucher/settlement, and delete coverage

Verification already run:
- focused real Chrome test for `enterprise user can login and open core enabled modules`: output showed 1 passed; Playwright teardown hung and was interrupted after pass output.
- `bash scripts/verify.sh`: passed.
- `bash scripts/browser-smoke.sh`: full real Chrome 23/23 passed.
- `code-review-graph build --skip-flows && code-review-graph detect-changes`: risk 0.50, no test gaps.

Please audit for blockers only:
1. Does the new test actually cover construction-contract progress receipt creation/read-back on the contract detail page?
2. Is it brittle in a way that could mask a real product defect or create false confidence?
3. Does it accidentally weaken any existing upload/download/delete coverage?
4. Does it restore or reference the removed inventory alert feature?

Return PASS/WARN/FAIL with concise evidence and any required fixes before commit.
