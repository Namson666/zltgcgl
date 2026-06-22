# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S3 browser smoke harness green
- Current task: 真实 Chrome 浏览器 smoke harness + 证据链
- Last completed: 用户批准实施计划，要求全程 Superpowers Pro、尽量调用 Claude CLI、最终真实浏览器全功能验收
- In progress: 准备提交并推送浏览器 smoke harness
- Next action: 提交/推送 smoke harness；随后进入 Phase 3 合同管理重构
- Blockers: 完整 CRUD/上传/下载/异常处理浏览器回归尚未建立/执行；前后端 npm audit 存在 high 漏洞，作为 Yellow 技术债记录
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
- Last verified command: `bash scripts/browser-smoke.sh` passed in system Google Chrome: enterprise login/core navigation and developer login/tenant management
- Claude worker evidence: `.ai/workers/20260622T114708Z-audit_worker.result.md` returned PASS_WITH_NOTES; portal loading UX note fixed
- Last commit: 8b78ec0 feat: add tenant module entitlement foundation
- Safe rollback point: 8b78ec0
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json` and screenshots under `docs/smoke-evidence/`
- Updated at: 2026-06-22T12:05:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
