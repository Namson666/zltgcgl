# audit_worker: Browser smoke harness review

Review the current uncommitted diff for the real-browser smoke harness:

- Playwright added to the frontend package
- `frontend/playwright.config.ts`
- `scripts/start-browser-smoke-server.sh`
- `scripts/browser-smoke.sh`
- `frontend/tests/smoke/browser-smoke.spec.ts`
- Vite proxy target made configurable via `VITE_API_TARGET`
- evidence under `docs/smoke-evidence/`

Check that:

1. The harness uses a temporary SQLite database and does not mutate the developer DB.
2. The backend receives required test-only env vars.
3. It uses real system Chrome via Playwright channel.
4. The smoke coverage is honestly scoped as baseline login/navigation, not full Product Green.
5. Any security or reliability risks are called out.

Use read-only commands only. Do not edit files.

Return verdict: `PASS`, `PASS_WITH_NOTES`, or `FAIL`.
