# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S27 contract P&L detail verified pending push
- Current task: 合同盈亏详情页已通过真实 Chrome：发票/收款后用后端 P&L API 回读 totals，再核对列表和详情页 UI 金额；库存预警仍不恢复、不纳入验收矩阵
- Last completed: 合同三 tab 及承包/采购/分包合同上传下载删除链路已通过真实 Chrome；本阶段新增开发者默认小程序、企业自有小程序配置、人员人脸上传、移动打卡、县份异常、批量处理异常、添加个人信任打卡地；强化项补齐信任地列表/删除、打卡照片入口、人脸照片预览、开发者/企业小程序配置真实 Chrome 覆盖；本轮新增生产可接入的人脸识别 HTTP/cloud/tencent/baidu/aliyun provider 契约、安全降级、路径穿越防护、环境变量示例和前端 provider 选择；供应商/班组 CRUD、劳资导出修复、劳资人员/考勤/工资/风控深测、模块开通/独立登录、基础后台角色/用户/项目部 CRUD、物资主链路、财务备用金/费用凭证、财务发票/收款/盈亏/导入导出、财务类别设置与回收站生命周期、项目部报账审核/驳回、开发者公告/系统配置/API Key/套餐生命周期、开发者 AI/OCR 配置生命周期均已通过真实 Chrome
- In progress: 准备进入下一轮剩余历史业务页面深度 CRUD/上传下载验收；库存预警已移出产品范围，不作为后续功能板块验收项
- Next action: 继续补齐剩余历史业务页面深度 CRUD/上传下载验收，并配置真实第三方人脸识别网关/密钥
- Blockers: 无 Phase 4 功能阻塞；Product Green 仍有 Yellow 项：生产 DNS/反代/证书未接入真实域名验证、真实第三方人脸识别网关/密钥未在仓库中配置、全量所有模块穷举点击回归尚未扩展到每个历史页面
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
- Last verified command: focused Chrome `finance invoice receipt pnl import export CRUD` passed 1/1; `bash scripts/verify.sh` passed with backend Prisma generate + backend tests/build + frontend tests/build; full `bash scripts/browser-smoke.sh` passed real Chrome 23/23; Claude worker PASS (`.ai/workers/20260623T090947Z-audit_worker.result.md`); `code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.50 with 0 test gaps
- Claude worker evidence: `.ai/workers/20260622T142134Z-audit_worker.result.md` first found a blocker-risk around photo read failure; fixed. `.ai/workers/20260622T142430Z-audit_worker.result.md` returned PASS / BLOCKERS none; path traversal Yellow was also fixed and reverified.
- Claude worker evidence: latest `.ai/workers/20260622T150714Z-audit_worker.result.md` returned PASS after fixing the WorkTeam search field blocker found by `.ai/workers/20260622T150334Z-audit_worker.result.md`.
- Claude worker evidence: latest `.ai/workers/20260622T153551Z-audit_worker.result.md` returned PASS for inventory alert removal and labor export fixes.
- Claude worker evidence: latest `.ai/workers/20260622T155005Z-audit_worker.result.md` returned PASS for module entitlement and independent portal login smoke coverage.
- Claude worker evidence: latest `.ai/workers/20260622T161953Z-audit_worker.result.md` returned PASS for inventory alert removal refresh and basic admin CRUD integration fixes.
- Claude worker evidence: latest `.ai/workers/20260622T164208Z-audit_worker.result.md` returned PASS for WMS main chain and ledger/export consistency after the earlier `.ai/workers/20260622T163631Z-audit_worker.result.md` note was fixed.
- Claude worker evidence: latest `.ai/workers/20260622T175646Z-audit_worker.result.md` returned PASS for finance invoice/receipt/P&L/import/export.
- Claude worker evidence: latest `.ai/workers/20260623T024042Z-audit_worker.result.md` returned PASS for labor personnel/attendance/salary/risk deep CRUD.
- Claude worker evidence: `.ai/workers/20260623T025250Z-audit_worker.result.md` returned PASS for inventory alert schema cleanup; latest `.ai/workers/20260623T030102Z-audit_worker.result.md` returned PASS for final inventory alert schema cleanup + Prisma generate guard audit.
- Claude worker evidence: latest `.ai/workers/20260623T032115Z-audit_worker.result.md` returned PASS for finance category settings + recycle-bin lifecycle, with no blockers and no Yellow risks.
- Claude worker evidence: latest `.ai/workers/20260623T033928Z-audit_worker.result.md` returned PASS for project department reimbursement review, tenant-scoped approve/reject, scoped payer fallback, and reject UI. Yellow follow-ups: optional reject confirmation and idempotent review policy.
- Claude worker evidence: latest `.ai/workers/20260623T042229Z-developer_ui_module_portal_audit.result.md` returned PASS for developer UI module entitlement + independent login configuration, with Yellow follow-ups for true Host/DNS portal validation, logo/theme style assertions, and additional boundary tests; semantic input selector Yellow was fixed with portal field testids.
- Claude worker evidence: latest `.ai/workers/20260623T043739Z-portal_host_audit.result.md` returned WARN but confirmed `portal-<stamp>.localhost` covers real Host semantics; Vite/CORS concerns are resolved by focused/full Chrome runtime evidence.
- Claude worker evidence: latest `.ai/workers/20260623T045726Z-developer_announcements_final2_audit.result.md` returned PASS for developer announcement lifecycle and developer-only API permissions; Yellow notes are optional status compatibility cleanup and a brittle delete selector.
- Claude worker evidence: latest `.ai/workers/20260623T051829Z-audit_worker.result.md` returned PASS for developer system config + API Key lifecycle; its rawKey memory and isActive precedence Yellow notes were fixed and reverified.
- Claude worker evidence: `.ai/workers/20260623T060949Z-audit_worker.result.md` first returned WARN for missing OCR sensitiveFields; fixed. Latest `.ai/workers/20260623T061427Z-audit_worker.result.md` returned PASS for developer AI/OCR config lifecycle and sensitive-field clearing.
- Claude worker evidence: latest `.ai/workers/20260623T064135Z-audit_worker.result.md` returned PASS for developer integrations/security/monitoring/logs with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T070020Z-audit_worker.result.md` returned PASS for developer payments/invoices/storage with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T071634Z-audit_worker.result.md` returned PASS for enterprise subscription lifecycle with no blockers.
- Claude worker evidence: `.ai/workers/20260623T083441Z-audit_worker.result.md` failed due to Claude budget limit only; latest `.ai/workers/20260623T083550Z-audit_worker.result.md` returned PASS for finance dashboard real-summary data with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T085253Z-audit_worker.result.md` returned PASS for contract construction progress receipt coverage with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T090947Z-audit_worker.result.md` returned PASS for contract P&L detail API/UI coverage with no blockers.
- code-review-graph evidence: latest `code-review-graph build --skip-flows && code-review-graph detect-changes` ran; graph built 136 files / 1568 nodes / 22981 edges; risk score 0.50 with 0 test gaps. Contract P&L detail UI/API check is covered by focused and full real Chrome assertions.
- Previous pushed implementation commit: `ebf731c feat: add supplier and work team CRUD coverage`
- Safe rollback point: pushed commit `f171bc2 chore: mark full route matrix pushed`
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json`, `docs/smoke-evidence/playwright-report/index.html`, legacy screenshots, `docs/smoke-evidence/full-route-*.png`, `docs/smoke-evidence/供应商班组CRUD.png`, `docs/smoke-evidence/劳资工资发放导出.png`, `docs/smoke-evidence/劳资人员考勤工资风控CRUD.png`, `docs/smoke-evidence/模块开通独立登录验收.png`, `docs/smoke-evidence/开发者UI模块开通独立登录.png`, `docs/smoke-evidence/基础后台CRUD.png`, `docs/smoke-evidence/物资主链路CRUD.png`, `docs/smoke-evidence/财务备用金费用CRUD上传.png`, `docs/smoke-evidence/财务看板真实汇总数据.png`, `docs/smoke-evidence/财务发票收款盈亏导入导出.png`, `docs/smoke-evidence/财务类别回收站CRUD.png`, `docs/smoke-evidence/项目部报账审核驳回CRUD.png`, `docs/smoke-evidence/开发者套餐生命周期CRUD.png`, `docs/smoke-evidence/开发者AIOCR配置生命周期CRUD.png`, `docs/smoke-evidence/开发者集成安全监控日志CRUD.png`, `docs/smoke-evidence/开发者支付发票存储CRUD.png`, and `docs/smoke-evidence/企业订阅计划生命周期CRUD.png`; latest real Chrome smoke passed 23 tests
- Previous pushed implementation commit: `e7c0772 feat: remove inventory alerts and fix labor exports`
- Last pushed implementation commit: `b122ebc test: cover module entitlements and portal login`
- Previous implementation commit: `5fe8382 test: cover admin crud and remove inventory alert docs`
- Previous implementation commit: current HEAD `test: cover wms main inventory flow`
- Previous implementation commit: `692025b test: cover finance voucher upload crud`
- Previous implementation commit: `dad2f12 test: cover finance invoice receipt import export`
- Previous implementation commit: `02d3ffa test: cover labor deep crud flows`
- Latest pushed implementation commit before S14: `75b2668 chore: remove inventory alert schema residue`; latest pushed status marker before S14: `f0cfb7f chore: mark inventory alert cleanup pushed`
- Latest pushed implementation commit: `16b26c0 test: cover finance category recycle lifecycle`
- Latest pushed implementation commit: `dc676cb test: cover department reimbursement review`
- Latest pushed implementation commit: `7e58b7d test: cover developer UI module portal flow`
- Latest pushed implementation commit: `14245ae test: cover independent portal host login`
- Latest pushed implementation commit: `de4b48e test: cover developer announcement lifecycle`
- Latest pushed implementation commit: `3dd1dd6 test: cover developer config api key lifecycle`
- Latest pushed implementation commit: `68e2874 test: cover developer plan lifecycle`
- Latest pushed implementation commit: `1fb9b96 test: cover developer AI OCR config lifecycle`
- Latest pushed implementation commit: `0540256 test: cover developer integration security observability`
- Latest pushed implementation commit: `c7ae6b5 test: cover developer payments invoices storage`
- Latest verified implementation pending push: contract P&L detail API/UI coverage
- Updated at: 2026-06-23T09:20:00Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
