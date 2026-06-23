# Claude audit request: labor personnel/attendance/salary/risk deep CRUD

Please audit the current diff for the ZLT engineering management system.

Scope:

1. Labor personnel flow
   - Personnel create/edit remains tenant-scoped.
   - Leave accepts the UI payload and rejoin returns personnel to active status.
   - Personnel attachment upload/download/delete is covered in real Chrome and does not weaken file safety.

2. Attendance flow
   - Attendance dates are persisted correctly as DateTime.
   - Batch attendance no longer reports fake success when writes fail.
   - Browser smoke proves batch attendance and patch attendance via backend evidence.

3. Salary and risk flow
   - Salary manual adjustment UI calls tenant-scoped backend update.
   - Risk anomaly list displays backend anomaly fields correctly and resolve uses the correct API.
   - Browser smoke proves salary calculate/edit/export and anomaly create/resolve.

4. Gates
   - Public repo: check for accidental secrets.
   - Module entitlement boundaries: no route should bypass existing labor module guard.
   - Fake-completion risk: call out any weak or indirect evidence.

Commands already run locally before this audit:

- `bash scripts/verify.sh` passed.
- Focused real Chrome: `BROWSER_SMOKE_DB_PATH=/private/tmp/zlt_browser_smoke_labor_deep.db npx playwright test --config playwright.config.ts -g "labor personnel attendance salary and risk CRUD"` passed.
- Full real Chrome: `rm -rf backend/uploads docs/smoke-evidence/test-results && bash scripts/browser-smoke.sh` passed 12/12.

Return PASS/BLOCKERS with concise notes.
