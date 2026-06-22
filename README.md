# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S1 context discovery / refactor preparation
- Current task: 准备把现有项目重构并迁移到公开仓库 git@github.com:Namson666/zltgcgl.git
- Last completed: 已创建公开安全基线 root commit，并确认未跟踪 .env/.db/.sqlite/SQLite journal 文件
- In progress: 查看开发文档，准备确认第一阶段重构切片
- Next action: 确认第一阶段重构目标；确认后写设计文档和实施计划
- Blockers: 后端 TypeScript build 失败；前后端 npm audit 存在 high 漏洞；重构设计未确认
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
- Last verified command: backend npm test passed; backend npm run build failed; frontend npm test passed; frontend npm run build passed; backend/frontend npm audit --audit-level=high failed
- Last commit: 931dd69 chore(prisma): add initial migration (62 tables)
- Safe rollback point: 931dd69
- Updated at: 2026-06-22T09:28:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
