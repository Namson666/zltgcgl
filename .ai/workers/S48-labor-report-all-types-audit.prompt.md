Independent audit_worker for S48 labor report all frontend types coverage.

Review current uncommitted diff only, focused on frontend/tests/smoke/browser-smoke.spec.ts.

Context:
- S47 fixed backend typed labor report export.
- S48 extends real Chrome coverage so every frontend dropdown type in /labor/reports is covered: salary, social, payment, attendance.
- Test now uses helper expectTypedReportExport to select type, assert select value, request backend /api/labor/reports/export?type=..., parse actual xlsx worksheet names with ExcelJS, click the real UI export button, assert suggested filename, and assert success toast.
- Payment and attendance still also assert preview behavior where data exists / expected difference. Salary/social may have no rows in the test month, so they prove type selection + real xlsx/download rather than preview rows.
- Existing evidence on final code:
  - Focused Chrome `enterprise user can download labor salary payment and report exports` passed 1/1.
  - `bash scripts/verify.sh` passed backend 57 tests/build + frontend 36 tests/build.
  - `bash scripts/browser-smoke.sh` passed 35/35.
  - `code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.50; static gap is helper expectTypedReportExport, which is executed by real Chrome.

Return PASS/WARN/FAIL with blockers, yellow risks/followups, and whether S48 acceptance is implemented/covered.
