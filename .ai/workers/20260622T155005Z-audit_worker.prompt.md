# audit_worker: module entitlement + independent portal smoke coverage

You are an independent Claude CLI audit worker for the ZLT engineering management system.

Audit the current uncommitted diff only. Do not modify files.

Scope:

1. The browser smoke suite now includes real coverage for tenant module entitlements:
   - create/register a temporary tenant;
   - configure that tenant to enable only `wms` and disable `labor` / `finance`;
   - login through the normal tenant-code flow;
   - verify disabled module menus are hidden;
   - verify direct frontend route access for disabled module routes is blocked/redirected;
   - verify direct backend API calls for disabled modules return 403;
   - verify enabled `wms` route/API still works.

2. The browser smoke suite now includes real coverage for independent tenant portal login:
   - developer enables a tenant portal config;
   - login page loads the tenant-specific title/company branding;
   - tenant-code field is not shown;
   - developer login tab is not shown;
   - enterprise user can login without tenant code by portal host.

Evidence already run by Codex:

- `bash scripts/verify.sh` passed.
- `bash scripts/browser-smoke.sh` passed 7/7 in system Google Chrome.

Please return:

- PASS or FAIL.
- Blocking issues if this does not prove the stated requirements.
- Non-blocking risks/follow-ups.
- Specific files/lines when useful.

