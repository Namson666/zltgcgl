# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S3 phase 2 local verification complete
- Current task: 企业独立登录页底座 + Claude CLI worker 证据链
- Last completed: 用户批准实施计划，要求全程 Superpowers Pro、尽量调用 Claude CLI、最终真实浏览器全功能验收
- In progress: 准备提交并推送第二阶段实现
- Next action: 提交/推送 phase 2；随后进入 Phase 3 合同管理重构，或先补真实浏览器 smoke harness
- Blockers: 完整浏览器回归尚未建立/执行；前后端 npm audit 存在 high 漏洞，作为 Yellow 技术债记录
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
- Last verified command: `bash scripts/verify.sh` passed: backend 24 tests, backend build, frontend 36 tests, frontend build
- Claude worker evidence: `.ai/workers/20260622T114708Z-audit_worker.result.md` returned PASS_WITH_NOTES; portal loading UX note fixed
- Last commit: 8b78ec0 feat: add tenant module entitlement foundation
- Safe rollback point: 8b78ec0
- Updated at: 2026-06-22T11:50:30Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
