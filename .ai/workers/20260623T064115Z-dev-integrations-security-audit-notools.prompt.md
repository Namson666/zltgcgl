Do not use tools. Based only on this summary, provide PASS/WARN/FAIL and any blocker.

S22 diff summary:
- Integrations page now unwraps `/api/developer/integrations` response `{success,data: []}`, maps configs by `platform`, shows saved config as not enabled, and marks enabled only after test succeeds. Added test ids.
- Security page now unwraps `{success,data}` and converts systemConfig string values into number/boolean so `"false"` is not treated as true. Added test ids.
- Logs page now passes `module` query param, uses uppercase backend action enum values, and displays/filter options for `integration` and `security`. `logApi.getLogs` type now includes `module`.
- Monitoring page only adds test ids for real browser assertions.
- Playwright smoke adds `developer can manage integrations security monitoring and logs`: developer login, enterprise token 403 checks, integration save/test/edit backend readback, security save/backend readback, monitoring read, logs API and UI filter assertions, screenshot evidence.
- Verified locally: focused Chrome 1 passed; `bash scripts/verify.sh` passed; full `bash scripts/browser-smoke.sh` passed 20/20; code-review-graph risk 0.50.
- User requirement: inventory alert / 库存预警 is deleted and must not be restored. This S22 diff does not add `/wms/alerts`, inventory alert menu/API, InventoryAlert, alertThreshold, or browser route matrix entries. Non-inventory warnings such as labor risk warning and UI warning colors are intentionally preserved.

Output concise:
- Verdict
- Blockers
- File-level findings
- Inventory alert conclusion
