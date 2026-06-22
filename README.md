# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S5 Phase 3 procurement contracts green
- Current task: 采购合同关联承包合同、付款记录、发票/付款凭证附件切片
- Last completed: 合同三 tab 已落地；承包合同详情附件已改为合同自有 API；采购合同可关联承包合同、登记付款记录、上传/认证下载/删除发票和付款凭证，并通过真实 Chrome 录入/上传/下载/删除验收
- In progress: Phase 3 采购合同切片已完成并进入推送交付
- Next action: 进入合同下一切片：分包合同新建/班组关联/付款与结算凭证
- Blockers: 分包合同完整 CRUD/上传/下载浏览器回归尚未实现；小程序打卡/异常/信任地点未实现；Phase 3 尚不是 Product Green；前后端 npm audit 存在 high 漏洞，作为 Yellow 技术债记录
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
- Last verified command: `bash scripts/verify.sh` and `bash scripts/browser-smoke.sh` passed after Phase 3 procurement contract slice
- Claude worker evidence: `.ai/workers/20260622T130415Z-audit_worker.result.md` returned PASS; BLOCKERS none; non-blocking updateContract/type notes were fixed after audit and reverified
- code-review-graph evidence: `code-review-graph build --skip-flows && code-review-graph detect-changes` ran; graph built 130 files / 1413 nodes / 14414 edges; risk score 0.50 due direct backend unit-test gaps, covered by current real Chrome smoke for this slice
- Last commit: current HEAD `feat: add procurement contract workflows`
- Safe rollback point: current HEAD after procurement contract slice
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json` and screenshots under `docs/smoke-evidence/`
- Updated at: 2026-06-22T13:08:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
