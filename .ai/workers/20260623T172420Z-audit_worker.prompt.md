Audit S49 in this repository. Scope:
- frontend/src/api/index.ts changed laborApi.createSubProgressPayment from /labor/sub-progress-payments to /labor/output-value/payments.
- frontend/src/__tests__/api.test.ts adds a unit regression for that API wrapper path.
- frontend/tests/smoke/browser-smoke.spec.ts adds a Playwright real-session API chain: create construction contract, labor subcontractor, legacy labor sub-contract, output value, progress payment at /api/labor/output-value/payments, list output value and sub-contract, cleanup, screenshot.

Please review for blockers only:
1. Does the frontend wrapper now match the actual backend route?
2. Does the smoke test prove the legacy labor subcontract output-value/progress-payment chain under a real authenticated enterprise session?
3. Any tenant-scope, cleanup, false-positive, or test-flakiness blocker?
4. Confirm inventory alert / 库存预警 was not restored.

Return PASS if no blockers. Include concise Yellow notes only if non-blocking.
