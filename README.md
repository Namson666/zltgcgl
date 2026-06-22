# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S1 design draft / architecture contract
- Current task: 模块化 SaaS 重构设计：基础功能、模块开通、合同板块、独立登录页、小程序打卡
- Last completed: 已根据用户补充更新重构架构合同草案
- In progress: 等待用户审阅架构合同
- Next action: 用户确认后，写实施计划
- Blockers: 后端 TypeScript build 失败；前后端 npm audit 存在 high 漏洞；架构合同未最终确认
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
- Last verified command: backend npm test passed; backend npm run build failed; frontend npm test passed; frontend npm run build passed; backend/frontend npm audit --audit-level=high failed
- Last commit: 931dd69 chore(prisma): add initial migration (62 tables)
- Safe rollback point: 931dd69
- Updated at: 2026-06-22T10:02:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
