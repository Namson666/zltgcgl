Re-audit S49 after cleanup assertions were added. Scope:
- frontend/src/api/index.ts maps laborApi.createSubProgressPayment to /labor/output-value/payments.
- frontend/src/__tests__/api.test.ts verifies the wrapper path.
- frontend/tests/smoke/browser-smoke.spec.ts verifies the legacy labor subcontract output-value/progress-payment chain under a real enterprise login session and now asserts cleanup DELETE responses are 200.

Validation already passed locally after the cleanup assertion change:
- frontend API focused unit 1/1
- focused Playwright Chrome S49 1/1
- bash scripts/verify.sh passed backend 57 + frontend 37 + builds
- bash scripts/browser-smoke.sh passed Chrome 36/36

Please review for blockers only: route mismatch, tenant-scope issue, cleanup/flakiness issue, false positive, or inventory alert accidentally restored. Return PASS if no blockers.
