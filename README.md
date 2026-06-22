# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S4 Phase 3 contract tab foundation green
- Current task: 合同管理三 tab 基础底座
- Last completed: 合同管理已形成承包合同、采购合同、分包合同三 tab；分包合同列表改走合同基础接口 `/api/contracts/sub-contracts`，不再依赖劳资模块开通
- In progress: 准备提交并推送 Phase 3 合同 tab 基础切片
- Next action: 进入合同下一切片：合同自有附件上传/下载/删除、采购合同发票/支付凭证、分包合同新建/班组关联/付款与结算凭证
- Blockers: 完整 CRUD/上传/下载/异常处理浏览器回归尚未建立/执行；Phase 3 尚不是 Product Green；前后端 npm audit 存在 high 漏洞，作为 Yellow 技术债记录
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
- Last verified command: `bash scripts/verify.sh` and `bash scripts/browser-smoke.sh` passed after Phase 3 contract tab foundation
- Claude worker evidence: `.ai/workers/20260622T121408Z-audit_worker.result.md` returned PASS; non-blocking loading-state note fixed after audit
- Last commit: 71f5b7f test: add real chrome browser smoke harness
- Safe rollback point: 71f5b7f
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json` and screenshots under `docs/smoke-evidence/`
- Updated at: 2026-06-22T12:17:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
