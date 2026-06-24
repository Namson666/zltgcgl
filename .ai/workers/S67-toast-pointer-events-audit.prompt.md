# S67 audit: toast pointer-event regression fix

You are an independent audit_worker for a Superpowers Pro delivery gate.

## Context

The public repository real browser CI failed in Playwright smoke test:

- test: `enterprise user can export wms inventory and work team ledger with net quantities`
- failure: the `react-hot-toast` success toast `库存记录已导出` intercepted the next real browser click on `导出已出库`.

The proposed product fix is in `frontend/src/main.tsx`:

- set the global `Toaster` `containerStyle.pointerEvents` to `none`
- set toast `style.pointerEvents` to `none`

This keeps visual feedback but prevents toast overlays from eating real user clicks.

## Evidence already run locally

- `bash scripts/browser-smoke.sh --grep "enterprise user can export wms inventory and work team ledger with net quantities"` actually ran all 36 smoke tests and passed:
  - `36 passed (3.0m)`
- `bash scripts/verify.sh` passed:
  - backend tests 61 passed
  - backend build passed
  - frontend tests 38 passed
  - frontend build passed
  - smoke route matrix passed
  - production smoke guard passed
  - delivery evidence matrix passed
- `code-review-graph build --skip-flows && code-review-graph detect-changes` reported risk 0.40, with changed functions from the prior evidence-matrix script; no affected flows for this toast fix.

## Audit questions

1. Is the Toaster `pointerEvents: 'none'` change an appropriate product-level fix for a real browser click interception caused by transient success toasts?
2. Does it appear to hide or fake the browser smoke result?
3. Are there any likely regressions, especially if future toasts need clickable actions?
4. Is the local evidence sufficient to re-push and wait for CI?

Return:

- PASS or BLOCK
- concise findings
- any follow-up recommendations
