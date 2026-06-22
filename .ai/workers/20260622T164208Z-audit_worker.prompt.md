# Claude audit request: WMS main flow browser coverage

You are the independent `audit_worker` for a Superpowers Pro delivery pass.

Please review the current git diff and report PASS / FAIL with blockers.

Scope to audit:

1. WMS main product chain
   - Manual inbound from the UI should create/reuse a SubProject when a department and project name are provided, so later returns can select the same project.
   - Outbound should preserve enough work team information for the work-team ledger.
   - Returns should no longer write fields that do not exist on `ReturnItem`.
   - Work-team ledger should return the flat shape used by the frontend and support keyword filtering.

2. Browser coverage realism
   - New Playwright real Chrome flow should create inbound, create outbound, download outbound PDF, create return, create transfer, download transfer PDF, and verify ledger visibility.
   - Make sure it is not just route-open smoke or API-only fake coverage.

3. Risks
   - Tenant isolation and module entitlement boundaries.
   - Inventory accounting regressions caused by subProject/department handling.
   - Data-loss or destructive behavior.
   - Public repo secret leakage.

Known verification already run:

- `bash scripts/verify.sh` passed.
- `bash scripts/browser-smoke.sh` passed 9/9 in system Google Chrome.

Return:

- `PASS` if there are no blocking issues.
- `FAIL` if a blocker exists, with exact file/line and suggested fix.
