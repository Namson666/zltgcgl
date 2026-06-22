# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S6 full route browser matrix green pending push
- Current task: 小程序接入、人员人脸、微信打卡、异常批量处理、个人信任打卡地 V1、强化项、人脸识别 HTTP 网关、依赖审计 Green 与全路由真实 Chrome 矩阵已完成验证，准备提交推送
- Last completed: 合同三 tab 及承包/采购/分包合同上传下载删除链路已通过真实 Chrome；本阶段新增开发者默认小程序、企业自有小程序配置、人员人脸上传、移动打卡、县份异常、批量处理异常、添加个人信任打卡地；强化项补齐信任地列表/删除、打卡照片入口、人脸照片预览、开发者/企业小程序配置真实 Chrome 覆盖；本轮新增生产可接入的人脸识别 HTTP/cloud/tencent/baidu/aliyun provider 契约、安全降级、路径穿越防护、环境变量示例和前端 provider 选择
- In progress: 全路由真实 Chrome 矩阵已完成验证，待提交推送
- Next action: 提交并推送 full route browser matrix；随后继续把每个页面的 CRUD/上传下载/导入导出深度验收补齐，并配置真实第三方人脸识别网关/密钥
- Blockers: 无 Phase 4 功能阻塞；Product Green 仍有 Yellow 项：真实第三方人脸识别网关/密钥未在仓库中配置、全量所有模块穷举点击回归尚未扩展到每个历史页面
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
- Last verified command: `bash scripts/verify.sh`, `bash scripts/browser-smoke.sh`, and `code-review-graph build --skip-flows && code-review-graph detect-changes` passed after full route browser matrix slice
- Claude worker evidence: `.ai/workers/20260622T142134Z-audit_worker.result.md` first found a blocker-risk around photo read failure; fixed. `.ai/workers/20260622T142430Z-audit_worker.result.md` returned PASS / BLOCKERS none; path traversal Yellow was also fixed and reverified.
- code-review-graph evidence: latest `code-review-graph build --skip-flows && code-review-graph detect-changes` ran; graph built 136 files / 1502 nodes / 15937 edges; risk score 0.55 because route-matrix test helpers are marked as changed helper functions.
- Last commit: current pushed HEAD `f97bc37 chore: mark dependency audit green pushed`; full route browser matrix pending commit
- Safe rollback point: pushed commit `f97bc37 chore: mark dependency audit green pushed`
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json`, legacy screenshots, and `docs/smoke-evidence/full-route-*.png`; latest real Chrome smoke passed 4 tests, enterprise 32 routes and developer 15 routes
- Updated at: 2026-06-22T14:58:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
