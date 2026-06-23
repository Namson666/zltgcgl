Role: audit_worker

Scope: review the finance contract P&L detail browser coverage slice.

Changes to inspect:
- frontend/tests/smoke/browser-smoke.spec.ts

Context:
- The user requires Superpowers Pro delivery discipline, Claude CLI audit evidence, and real Chrome/browser validation before delivery.
- Inventory alert / 库存预警 has been removed from product scope and must not be restored.
- This slice extends the existing finance invoice/receipt/P&L/import/export real Chrome flow:
  - create invoice
  - create receipt linked to invoice
  - API-read contract P&L totals
  - open `/finance/contract-pnl`
  - assert the row contains the API receipt total
  - click `查看详情`
  - assert URL `/finance/contract-pnl/:contractId`
  - assert the detail page heading and API receipt/invoice totals are visible
  - continue existing import/export and cleanup coverage

Verification already run:
- focused real Chrome `finance invoice receipt pnl import export CRUD`: 1/1 passed.
- `bash scripts/verify.sh`: passed.
- `bash scripts/browser-smoke.sh`: passed 23/23 twice after the slice was added; final pass after helper cleanup.
- `code-review-graph build --skip-flows && code-review-graph detect-changes`: risk 0.50, 0 test gaps after helper cleanup.

Please audit for blockers only:
1. Does the new test actually verify the contract P&L detail page UI against backend P&L API totals?
2. Is it brittle in a way that masks product defects or creates false confidence?
3. Does it weaken existing invoice/receipt/import/export cleanup coverage?
4. Does it restore or reference removed inventory alert functionality?

Return PASS/WARN/FAIL with concise evidence and required fixes before commit.
