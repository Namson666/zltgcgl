You are the independent Superpowers Pro Claude CLI audit_worker for S50 of the public-clean-baseline branch.

Audit scope:
- Backend face provider diagnostic helper in `backend/src/modules/labor/face-provider.ts`.
- Authenticated attendance route `GET /api/labor/attendance/mobile/face-provider/status` in `backend/src/modules/labor/routes.ts`.
- Frontend API wrapper `laborApi.getFaceProviderStatus`.
- Labor Attendance UI button/card for `检测人脸网关`.
- Real Chrome smoke coverage added to the labor attendance CRUD scenario.

Important intended behavior:
- The diagnostic route must require the existing attendance-management permission boundary.
- It must not expose provider endpoint URLs or API keys/secrets; only booleans and normalized operational values are allowed.
- Stub mode may report ready for development/testing, but the message must clearly say production should configure an HTTP/cloud gateway.
- HTTP/cloud aliases should be not ready when `FACE_RECOGNITION_HTTP_ENDPOINT` is missing, and ready when it is configured.
- The frontend must not hardcode secrets and must show clear operator feedback.
- Existing inventory alert/reminder/prewarning functionality must not be reintroduced.

Validation evidence already run locally:
- `cd backend && npm test -- --run src/modules/labor/face-provider.test.ts` passed 12 tests.
- `cd frontend && npm test -- --run src/__tests__/api.test.ts` passed 2 tests.
- Focused real Chrome test for labor personnel/attendance/salary/risk CRUD passed.
- `bash scripts/verify.sh` passed backend Prisma generate, backend 8 files / 60 tests, backend build, frontend 3 files / 38 tests, frontend build.
- `bash scripts/browser-smoke.sh` passed 36/36 real Chrome scenarios.
- `code-review-graph build --skip-flows && code-review-graph detect-changes` reported risk 0.50 and test gaps for changed UI/helper functions; please judge those against the focused tests and Chrome evidence above.

Please review the current diff. Return:
1. PASS or BLOCKED.
2. Any blocking issue with file/line and exact reason.
3. Non-blocking concerns separately.
