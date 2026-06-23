Independent final audit for S47 labor report typed export.

Review current uncommitted diff only. Focus files:
- backend/src/modules/labor/routes.ts
- frontend/tests/smoke/browser-smoke.spec.ts

Acceptance:
1. /api/labor/reports/export with type=payment creates one sheet: 工资发放明细表.
2. type=attendance creates one sheet: 月度考勤汇总表.
3. invalid type returns 400 INVALID_REPORT_TYPE.
4. missing type keeps legacy all-report sheets: 月度工资汇总表, 欠薪统计表, 异常人员明细表, 工资发放记录表.
5. auth/permission unchanged.
6. Real Chrome test proves payment/attendance UI preview/download and parses backend xlsx sheet names for payment, attendance, invalid type, and legacy no-type.

Evidence already run on final code:
- focused Chrome payment/report export test passed 1/1.
- bash scripts/verify.sh passed backend 57 tests/build + frontend 36 tests/build.
- bash scripts/browser-smoke.sh passed 35/35.
- code-review-graph risk 0.50; only workbookSheetNames static test gap, but helper is executed by real Chrome assertions.

Return PASS/WARN/FAIL, blockers, yellow follow-ups, and whether all acceptance items are implemented and covered.
