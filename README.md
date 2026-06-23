# 资料通工程管理系统

## Superpowers Pro Handoff

### Resume Here / 最新接手点
- Current mode: Enforced Delivery
- Current phase: S54 CI npm10 lockfile fix verified pending push
- Current task: GitHub Actions 首次远端 run 暴露后端 npm10 lockfile 同步问题；已用 npm 10.8.2 刷新 lockfile 并本地验证，等待推送重跑 CI；库存预警仍不恢复、不纳入验收矩阵
- Last completed: 合同三 tab 及承包/采购/分包合同上传下载删除链路已通过真实 Chrome；本阶段新增开发者默认小程序、企业自有小程序配置、人员人脸上传、移动打卡、县份异常、批量处理异常、添加个人信任打卡地；强化项补齐信任地列表/删除、打卡照片入口、人脸照片预览、开发者/企业小程序配置真实 Chrome 覆盖、小程序同手机号多企业冲突保护、冲突后选择企业打卡 appId 校验闭环、管理员手机号预绑定和企业自有 appId 直达验收；本轮新增生产可接入的人脸识别 HTTP/cloud/tencent/baidu/aliyun provider 契约、安全降级、路径穿越防护、环境变量示例和前端 provider 选择；供应商/班组 CRUD、劳资导出修复、劳资人员/考勤/工资/风控深测、劳资工资发放生命周期、模块开通/独立登录、基础后台角色/用户/项目部 CRUD、物资主链路、物资档案、入库/送货单/OCR、退库、出库、调拨、库存/台账导出、财务备用金/费用凭证、财务发票/收款/盈亏/导入导出、财务类别设置与回收站生命周期、项目部报账审核/驳回、开发者公告/企业端公告首页可见/系统配置/API Key/套餐/AI-OCR/集成安全监控日志/支付发票存储/企业订阅/企业管理 CRUD 用户回收站生命周期、企业首页数据看板真实汇总、开发者首页数据看板真实汇总、公开注册企业登录闭环均已通过真实 Chrome
- In progress: S54 已验证：远端 CI run `28061042978` 在 backend `npm ci` 失败；本地用 `npx npm@10.8.2 install --package-lock-only` 刷新 `backend/package-lock.json`，并用 npm 10.8.2 clean `npm ci`、`bash scripts/verify.sh`、code-review-graph、Claude 审查验证通过
- Next action: 推送 S54；随后读取 GitHub Actions run，若通过再把 CI Green 标记为 verified
- Blockers: 无 Phase 4 功能阻塞；Product Green 仍有 Yellow 项：生产 DNS/反代/证书未接入真实域名验证、真实第三方人脸识别网关/密钥未在仓库中配置、全量所有模块穷举点击回归尚未扩展到每个历史页面
- Do not repeat: 不要恢复库存预警；不要把 Build Green 当 Product Green
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
- Last verified command: `node --check scripts/production-smoke.mjs`；无 `PRODUCTION_BASE_URL` 退出 2；本地真实前后端 dry-run 带门户/开发者 Token 返回 Yellow（人脸网关未配置）并保存 `docs/smoke-evidence/production-external-smoke-local-yellow.json`；`bash scripts/verify.sh` passed backend 61 + frontend 38 + builds；full `bash scripts/browser-smoke.sh` passed real Chrome 36/36；`code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.00 / 0 gaps；Claude CLI worker `.ai/workers/20260623T220545Z-audit_worker.result.md` returned PASS
- S53 verified command: Ruby YAML parse passed；`bash scripts/verify.sh` passed backend 61 + frontend 38 + builds；full `bash scripts/browser-smoke.sh` passed real Chrome 36/36；`code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.00 / 0 gaps；Claude CLI worker `.ai/workers/20260623T221751Z-audit_worker.result.md` returned PASS
- Claude worker evidence: latest `.ai/workers/20260623T221751Z-audit_worker.result.md` returned PASS for S53 GitHub Actions CI gate.
- S54 verified command: `npx npm@10.8.2 install --package-lock-only` refreshed backend lockfile；clean temp `npx npm@10.8.2 ci` passed；`bash scripts/verify.sh` passed backend 61 + frontend 38 + builds；`code-review-graph build --skip-flows && code-review-graph detect-changes` risk 0.00 / 0 gaps；Claude CLI worker `.ai/workers/20260623T222302Z-audit_worker.result.md` returned PASS
- Claude worker evidence: latest `.ai/workers/20260623T222302Z-audit_worker.result.md` returned PASS for S54 CI lockfile fix.
- Claude worker evidence: latest `.ai/workers/20260623T220545Z-audit_worker.result.md` returned PASS for S52 production external smoke gate.
- Claude worker evidence: latest `.ai/workers/20260623T214941Z-audit_worker.result.md` returned PASS for S51 production readiness self-check.

### Production external smoke gate

S52 adds a non-mutating production smoke script for the final external gate:

```bash
PRODUCTION_BASE_URL=https://your-web-domain.example \
PRODUCTION_API_BASE_URL=https://your-api-domain.example \
PRODUCTION_PORTAL_HOST=tenant-login.example \
PRODUCTION_DEVELOPER_TOKEN=*** \
EXPECT_FACE_GATEWAY_READY=1 \
node scripts/production-smoke.mjs
```

It checks `/login`, `/api/health`, `/api/v1/health`, optional independent-login portal config, and optional developer-only `/api/developer/readiness`. Missing portal/token/face-gateway inputs return Yellow; HTTPS is required by default. This script is evidence for Product Green only when run against the real production DNS/reverse proxy/certificates and real face gateway credentials.

- Claude worker evidence: latest `.ai/workers/20260623T174909Z-audit_worker.result.md` returned PASS for S50 final face provider diagnostic diff after typing cleanup; earlier `.ai/workers/20260623T174648Z-audit_worker.result.md` returned PASS and suggested the frontend diagnostic type tightening that was fixed before final verify.
- Claude worker evidence: latest `.ai/workers/20260623T172942Z-audit_worker.result.md` returned PASS for S49 labor legacy subcontract output-value/progress-payment API chain after cleanup DELETE status assertions; `.ai/workers/20260623T172420Z-audit_worker.result.md` first PASS identified the cleanup assertion Yellow that was fixed.
- Claude worker evidence: latest `.ai/workers/20260623T170959Z-audit_worker.result.md` returned PASS for S48 labor report all frontend types Chrome coverage.
- Claude worker evidence: latest `.ai/workers/20260623T165248Z-audit_worker.result.md` returned PASS for S47 labor report typed export after adding the no-type legacy four-sheet compatibility assertion; earlier `.ai/workers/20260623T164725Z-audit_worker.result.md` also PASS and suggested the compatibility assertion.
- Claude worker evidence: latest `.ai/workers/20260623T162630Z-audit_worker_S46_tenant_portal_logo_upload_resanitized.result.md` returned PASS for tenant portal Logo upload after SVG risk removal; first S46 Claude audit also PASS but raised SVG as a non-blocking security observation that was fixed before final verification.
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
- Claude worker evidence: latest `.ai/workers/20260623T153802Z-audit_worker.result.md` returned WARN with no blockers for mini-program phone prebinding; follow-ups are binding enable/disable toggle, rate-limit/generic validation hardening, and log action semantics.
- Claude worker evidence: latest `.ai/workers/20260623T051829Z-audit_worker.result.md` returned PASS for developer system config + API Key lifecycle; its rawKey memory and isActive precedence Yellow notes were fixed and reverified.
- Claude worker evidence: `.ai/workers/20260623T060949Z-audit_worker.result.md` first returned WARN for missing OCR sensitiveFields; fixed. Latest `.ai/workers/20260623T061427Z-audit_worker.result.md` returned PASS for developer AI/OCR config lifecycle and sensitive-field clearing.
- Claude worker evidence: latest `.ai/workers/20260623T064135Z-audit_worker.result.md` returned PASS for developer integrations/security/monitoring/logs with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T070020Z-audit_worker.result.md` returned PASS for developer payments/invoices/storage with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T071634Z-audit_worker.result.md` returned PASS for enterprise subscription lifecycle with no blockers.
- Claude worker evidence: `.ai/workers/20260623T083441Z-audit_worker.result.md` failed due to Claude budget limit only; latest `.ai/workers/20260623T083550Z-audit_worker.result.md` returned PASS for finance dashboard real-summary data with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T085253Z-audit_worker.result.md` returned PASS for contract construction progress receipt coverage with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T090947Z-audit_worker.result.md` returned PASS for contract P&L detail API/UI coverage with no blockers.
- Claude worker evidence: latest `.ai/workers/20260623T093146Z-audit_worker.result.md` returned PASS for WMS material catalog CRUD/export, tenant-scoped material update/delete, and no inventory-alert restoration.
- Claude worker evidence: latest `.ai/workers/20260623T094942Z-audit_worker.result.md` returned PASS for WMS inbound Excel import/export/delete-preview, supplier/department/sub-project/inventory association, and no inventory-alert restoration.
- Claude worker evidence: latest `.ai/workers/20260623T100445Z-audit_worker.result.md` returned PASS for WMS return Excel import/export/delete-preview, active-only return list/export soft-delete fix, and no inventory-alert restoration.
- Claude worker evidence: latest `.ai/workers/20260623T101938Z-audit_worker.result.md` returned PASS for WMS outbound UI create/PDF/export/delete-preview, active-only outbound export soft-delete fix, and no inventory-alert restoration.
- Claude worker evidence: latest `.ai/workers/20260623T103434Z-audit_worker.result.md` returned PASS for WMS transfer UI create/PDF/export/delete-preview, active-only transfer list/export, department-scoped transfer persistence/rollback, and no inventory-alert restoration.
- Claude worker evidence: latest `.ai/workers/20260623T105329Z-audit_worker.result.md` returned PASS for WMS inventory/work-team ledger exports, active-only net quantity, SQLite-safe search, and no inventory-alert restoration.
- Claude worker evidence: S34 prompts `.ai/workers/20260623T111326Z-wms-delivery-ocr-export-audit.prompt.md` and `.ai/workers/20260623T111326Z-wms-delivery-ocr-export-audit-short.prompt.md` were attempted through Claude CLI, but Claude hung/no-output twice and was interrupted; S34 remains verified by unit/build/focused Chrome/full Chrome/code-review-graph.
- Claude worker evidence: S35 prompt `.ai/workers/developer-tenant-crud-audit.prompt.md` was invoked through Claude CLI and timed out after 90 seconds; `.ai/workers/20260623T114711Z-audit_worker.result.md` and `.ai/workers/20260623T120109Z-audit_worker.result.md` record these as Yellow external-tool evidence, not PASS.
- code-review-graph evidence: latest `code-review-graph build --skip-flows && code-review-graph detect-changes` ran; graph built 137 files / 1622 nodes / 26374 edges; risk score 0.50. Static gaps for Register/handleSubmit are covered by focused and full real Chrome registration/login assertions.
- Previous pushed implementation commit: `ebf731c feat: add supplier and work team CRUD coverage`
- Safe rollback point: pushed commit `f171bc2 chore: mark full route matrix pushed`
- Browser smoke evidence: `docs/smoke-evidence/playwright-results.json`, `docs/smoke-evidence/playwright-report/index.html`, legacy screenshots, `docs/smoke-evidence/full-route-*.png`, `docs/smoke-evidence/供应商班组CRUD.png`, `docs/smoke-evidence/劳资工资发放导出.png`, `docs/smoke-evidence/劳资人员考勤工资风控CRUD.png`, `docs/smoke-evidence/模块开通独立登录验收.png`, `docs/smoke-evidence/开发者UI模块开通独立登录.png`, `docs/smoke-evidence/基础后台CRUD.png`, `docs/smoke-evidence/物资主链路CRUD.png`, `docs/smoke-evidence/物资档案CRUD导出.png`, `docs/smoke-evidence/入库导入导出删除预览.png`, `docs/smoke-evidence/退库导入导出删除预览.png`, `docs/smoke-evidence/出库导出删除预览.png`, `docs/smoke-evidence/调拨导出删除预览.png`, `docs/smoke-evidence/财务备用金费用CRUD上传.png`, `docs/smoke-evidence/财务看板真实汇总数据.png`, `docs/smoke-evidence/财务发票收款盈亏导入导出.png`, `docs/smoke-evidence/财务类别回收站CRUD.png`, `docs/smoke-evidence/项目部报账审核驳回CRUD.png`, `docs/smoke-evidence/开发者套餐生命周期CRUD.png`, `docs/smoke-evidence/开发者AIOCR配置生命周期CRUD.png`, `docs/smoke-evidence/开发者集成安全监控日志CRUD.png`, `docs/smoke-evidence/开发者支付发票存储CRUD.png`, `docs/smoke-evidence/企业订阅计划生命周期CRUD.png`, `docs/smoke-evidence/企业首页数据看板真实汇总.png`, `docs/smoke-evidence/开发者首页数据看板真实汇总.png`, `docs/smoke-evidence/公开注册企业登录闭环.png`, and `docs/smoke-evidence/小程序手机号多企业分流.png`; latest real Chrome smoke passed 35 tests
- Previous pushed implementation commit: `e7c0772 feat: remove inventory alerts and fix labor exports`
- Last pushed implementation commit: `1c2fa28 feat: add mini program phone prebinding`
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
- Latest pushed implementation commit: `aa96959 test: cover contract pnl detail totals`
- Latest pushed implementation commit: `bb1022c feat: add wms material catalog management`
- Latest pushed implementation commit: `f54298f feat: cover wms inbound import export flow`
- Latest pushed implementation commit: `157fefa feat: cover wms return import export flow`
- Latest pushed implementation commit: `48b2e18 feat: cover wms outbound export delete flow`
- Latest pushed implementation commit: `714028e feat: cover wms transfer export delete flow`
- Latest pushed implementation commit: `0cb6997 feat: cover wms inventory ledger exports`
- Latest pushed implementation commit: `bbb943a feat: cover wms delivery export ocr guard`
- Latest pushed implementation commit: `e31544b feat: cover enterprise dashboard summary`
- Latest pushed implementation commit: `b812fca feat: cover developer dashboard summary`
- Latest pushed implementation commit: `7311a49 feat: cover public registration login`
- Latest pushed implementation commit: `a616f85 feat: cover labor payment lifecycle`
- Latest pushed implementation commit: `2afa30a feat: show announcements on enterprise dashboard`
- Updated at: 2026-06-23T15:44:15Z

## 项目概览

资料通工程管理系统是面向施工企业的多租户 SaaS 管理平台，核心模块包括物资管理、劳资管理、合同/项目部管理、开发者后台与财务管理。

当前技术栈：

- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: Express 4 + TypeScript + Prisma + SQLite
- Monorepo: frontend / backend / shared / docs
