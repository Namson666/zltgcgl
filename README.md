# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S5 Phase 3 subcontract contracts green
- Current task: 分包合同关联承包合同/班组、付款记录、付款/结算凭证附件切片
- Last completed: 合同三 tab 已落地；承包合同附件、采购合同付款/发票/付款凭证、分包合同新建/班组关联/付款/付款凭证/结算凭证均已通过真实 Chrome 录入/上传/下载/删除验收
- In progress: Phase 3 分包合同切片已完成，准备提交推送
- Next action: 进入小程序/人员人脸/微信打卡/异常/个人信任地点切片
- Blockers: 小程序打卡/异常/信任地点未实现；Product Green 仍为 false；前后端 npm audit 存在 high 漏洞，作为 Yellow 技术债记录
- Do not repeat: 不要在未确认重构设计前修改业务代码；不要把 Build Green 当 Product Green
- Must read:
  1. .ai/REQUIRED_ACTION_CONTRACT.json
  2. .ai/HARNESS_SESSION.json
  3. .ai/PROJECT_STATUS.json
  4. .ai/SPEC_STATUS.json
  5. .ai/TEST_STATUS.json
  6. .ai/SKILL_INVOCATION_STATUS.json
  7. .ai/TOOL_INVOCATION_STATUS.json
  8. .ai/session/HANDOFF.md
- Must read spec:
  1. docs/superpowers/specs/2026-06-22-refactor-architecture-contract-design.md
- Last verified command: `bash scripts/verify.sh` and `bash scripts/browser-smoke.sh` passed after Phase 3 subcontract contract slice; `DATABASE_URL=file:/tmp/zlt_prisma_validate.db npx prisma validate` also passed
- Claude worker evidence: `.ai/workers/20260622T132705Z-audit_worker.result.md` returned PASS; BLOCKERS none; stale empty-state text was fixed after audit and reverified
- code-review-graph evidence: `code-review-graph build --skip-flows && code-review-graph detect-changes` ran; graph built 131 files / 1432 nodes / 14902 edges; risk score 0.50 due direct backend unit-test gaps, covered by current real Chrome smoke for this slice
- Last commit: current HEAD `feat: add procurement contract workflows`
- Safe rollback point: current HEAD before subcontract contract slice
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json` and screenshots under `docs/smoke-evidence/`
- Updated at: 2026-06-22T13:31:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
