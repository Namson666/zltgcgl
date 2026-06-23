Do not use tools. Reply concise PASS/WARN/FAIL.

Change summary:
- Developer payments backend now maps raw SubscriptionPayment to UI DTO and supports keyword/status filtering; seed creates demo completed payment.
- Developer invoices backend maps tenant fields; frontend creates invoices by selecting real tenantId, then issues invoice.
- Developer storage backend returns global summary and file DTO tenantName; frontend uses summary and adds testids.
- New real Chrome test verifies payments search/status, invoice create+issue API readback, storage attachment upload visibility, and enterprise 403 for developer APIs.
- Verified: focused Chrome 1 passed, `bash scripts/verify.sh` passed, full Chrome 21 passed, code-review-graph risk 0.50.
- Inventory alert remains deleted; no WMS alert route/menu/API/schema/browser matrix reintroduced.

Output:
Verdict, blockers, notable file findings, inventory-alert conclusion.
