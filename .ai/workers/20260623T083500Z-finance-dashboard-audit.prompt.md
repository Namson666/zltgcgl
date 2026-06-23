You are audit_worker for the ZLT engineering management system.

Scope: review the finance dashboard real-summary slice.

Changed areas to inspect:
- frontend/src/api/index.ts financeApi dashboard summary helpers
- frontend/src/pages/finance/FinanceDashboard.tsx
- frontend/tests/smoke/browser-smoke.spec.ts test "enterprise user can verify finance dashboard real summary data"

Expected behavior:
- Finance dashboard should use the current backend dashboard endpoints:
  - GET /api/finance/summary/dashboard
  - GET /api/finance/summary/monthly-trend
  - GET /api/finance/summary/category-breakdown
  - GET /api/finance/summary/department-ranking
- It should correctly unwrap AxiosResponse -> ApiResponse -> data.
- It should map backend fields:
  - monthExpenseTotal/yearExpenseTotal/pendingCount/pettyCashBalance
  - trend total
  - category total/count and client-computed percentage if backend does not return percentage
  - department total/count
- Browser evidence already passed:
  - focused Chrome finance dashboard real summary data 1/1
  - bash scripts/verify.sh passed
  - bash scripts/browser-smoke.sh passed 23/23
  - code-review-graph risk score 0.50
- Inventory alert / 库存预警 must not be restored.

Return:
1. Verdict: PASS / WARN / FAIL
2. Blockers, if any
3. Yellow risks, if any
4. Confirm whether this slice is safe to commit/push.
