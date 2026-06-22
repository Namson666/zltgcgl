# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S6 Phase 4 mobile check-in green
- Current task: 小程序接入、人员人脸、微信打卡、异常批量处理、个人信任打卡地 V1 已完成，准备提交推送
- Last completed: 合同三 tab 及承包/采购/分包合同上传下载删除链路已通过真实 Chrome；本阶段新增开发者默认小程序、企业自有小程序配置、人员人脸上传、移动打卡、县份异常、批量处理异常、添加个人信任打卡地，并通过真实 Chrome 验收
- In progress: Phase 4 已完成验证，待提交推送
- Next action: 提交并推送 Phase 4；随后决定生产级第三方人脸识别服务与依赖漏洞升级策略
- Blockers: 无 Phase 4 功能阻塞；Product Green V1 可用但生产上线仍有 Yellow 项：人脸识别目前是 stub 适配层、npm audit high 漏洞、信任地列表/删除和照片预览 UX 待补
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
- Last verified command: `bash scripts/verify.sh`, `bash scripts/browser-smoke.sh`, and `cd backend && DATABASE_URL=file:/tmp/zlt_prisma_validate.db npx prisma validate` passed after Phase 4 mobile check-in slice
- Claude worker evidence: `.ai/workers/20260622T135309Z-audit_worker.result.md` returned PASS; BLOCKERS none; Yellow notes are production face provider and UX follow-ups
- code-review-graph evidence: `code-review-graph build --skip-flows && code-review-graph detect-changes` ran; graph built 132 files / 1458 nodes / 15388 edges; risk score 0.50 due direct backend unit-test gaps, covered by current real Chrome smoke for this slice
- Last commit: current pushed HEAD `feat: add subcontract contract workflows`; Phase 4 changes pending commit
- Safe rollback point: pushed commit `0bf86bc feat: add subcontract contract workflows`
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json` and screenshots under `docs/smoke-evidence/`
- Updated at: 2026-06-22T13:56:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
