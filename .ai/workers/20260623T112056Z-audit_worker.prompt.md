# Short audit

Audit current git diff only. Check blockers:

- WMS delivery order export must stay tenant-scoped and use supplier/contract/subProject/date filters.
- Frontend "导出送货单" button must call the new export API and download.
- OCR upload failure path must not create bad records.
- Do not restore inventory alert / 库存预警.

Already passed: backend service tests, `bash scripts/verify.sh`, focused Playwright Chrome for delivery export/OCR upload, full real Chrome smoke 30/30, code-review-graph risk 0.50.

Return PASS if no blocker; otherwise exact blocker and minimal fix.
