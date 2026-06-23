You are audit_worker for the ZLT engineering management system.

Scope: review the enterprise subscription plan lifecycle slice.

Changed areas to inspect:
- frontend/src/pages/subscription/Plans.tsx
- frontend/src/api/index.ts subscriptionApi.changePlan
- frontend/tests/smoke/browser-smoke.spec.ts test "enterprise user can manage subscription plan lifecycle"

Expected behavior:
- The subscription page must match the current backend contract:
  - GET /api/subscription/current returns raw subscription fields such as plan, tier, maxUsers, currentUsers, currentPeriodEnd, status, pricePerMonth.
  - GET /api/subscription/plans returns grouped plan objects with tiers.
  - POST /api/subscription/change-plan expects { plan, tier }, not { planId }.
- UI must show the current subscription accurately, render selectable plan+tier cards, switch a plan through the real button, refresh current subscription, and keep auth.
- Browser evidence already passed:
  - focused Chrome subscription plan lifecycle 1/1
  - bash scripts/verify.sh passed
  - bash scripts/browser-smoke.sh passed 22/22
  - code-review-graph risk score 0.50
- Inventory alert / 库存预警 must not be restored.

Return:
1. Verdict: PASS / WARN / FAIL
2. Blockers, if any
3. Yellow risks, if any
4. Confirm whether this slice is safe to commit/push.
