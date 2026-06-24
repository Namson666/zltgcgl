# S61 audit: smoke route matrix coverage gate

Role: audit_worker

Please review the current repository diff for S61.

Context:

- The user requires true browser clicking of all functional sections before delivery.
- Existing Playwright smoke already has:
  - `enterpriseRouteMatrix`
  - `developerRouteMatrix`
  - full Chrome route screenshots
  - deep CRUD/upload/download slices.
- The gap being addressed here is future-proofing: Layout sidebar menu routes and smoke route matrices were manually duplicated, so a future menu route could be added without being included in the real-browser route matrix.
- S61 adds `scripts/check-smoke-route-matrix.mjs` and wires it into `scripts/verify.sh`.
- The script:
  - parses `frontend/src/components/layout/Layout.tsx`
  - extracts enterprise menu item label/path pairs and developer menu item label/path pairs
  - parses `frontend/tests/smoke/browser-smoke.spec.ts`
  - compares Layout menu routes against `enterpriseRouteMatrix` and `developerRouteMatrix`
  - allows `/subscription` as an extra non-sidebar enterprise route already covered by smoke
  - fails on inventory alert / 库存预警 residue in Layout or smoke matrix
- Evidence already gathered:
  - `node scripts/check-smoke-route-matrix.mjs` passed: 31 enterprise routes, 16 developer routes.
  - `bash scripts/verify.sh` passed: backend 61, frontend 38, builds, and route matrix check.
  - `bash scripts/browser-smoke.sh` passed: real Chrome 36/36.
  - `code-review-graph build --skip-flows && code-review-graph detect-changes` passed: risk 0.00, 0 gaps.

Audit questions:

1. Does this add a real guard toward the user's all-function-section browser-click requirement?
2. Is parsing Layout and smoke matrix acceptable for this repository, or is it too fragile to merge?
3. Is allowing `/subscription` as an extra non-sidebar route reasonable?
4. Does this accidentally restore or weaken the deleted inventory alert / 库存预警 scope?
5. Any blockers before commit/push?

Please answer with:

- PASS/WARN/FAIL
- Blockers, if any
- Non-blocking observations, if any
- Files reviewed
