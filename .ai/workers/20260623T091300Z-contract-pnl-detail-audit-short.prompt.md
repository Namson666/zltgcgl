Audit only changed test coverage in `frontend/tests/smoke/browser-smoke.spec.ts`.

Question: Does the added contract P&L detail-page check safely verify UI against backend API totals without weakening existing invoice/receipt/import/export cleanup? Also confirm it does not restore inventory alert / 库存预警.

Known verification:
- Focused Chrome P&L flow 1/1 passed.
- `bash scripts/verify.sh` passed.
- Full real Chrome smoke 23/23 passed after final helper cleanup.
- code-review-graph risk 0.50, 0 test gaps.

Return PASS/WARN/FAIL with blockers only.
