你是独立终审 worker。请审查本轮“开发者套餐管理生命周期”最终改动。

用户总要求：
- 全程 Superpowers Pro；
- 尽量调用 Claude CLI；
- 交付前必须真实浏览器点击功能板块，录入/删除测试通过；
- 使用 code-review-graph；
- 不要把 Build Green 当 Product Green；
- 库存预警功能已删除，不要恢复。

本轮最终改动：
- `frontend/src/pages/developer/Plans.tsx`
  - 为套餐表单和行新增稳定 testid。
- `backend/src/modules/developer/service.ts`
  - 新增套餐输入校验：
    - tier 只能是 SMALL/MEDIUM/LARGE；
    - type 只能是 FULL/MODULE；
    - pricePerMonth >= 0；
    - maxUsers >= 1；
    - pricePerExtraUser >= 0。
  - 删除套餐前查询 `Subscription` 是否存在同一 `plan=existing.type` + `tier=existing.tier` 组合；若存在，返回 409 `PLAN_HAS_SUBSCRIPTIONS`，避免误删正在被企业订阅的套餐组合。
- `backend/src/modules/developer/routes.ts`
  - create/update plan catch 中透传 service 层 status/code/message，避免校验错误被包装成 500。
- `frontend/tests/smoke/browser-smoke.spec.ts`
  - 新增/增强真实 Chrome 测试 `developer can manage platform plan lifecycle`：
    - UI 创建套餐，填写 7 个字段；
    - API 回读验证字段；
    - UI 列表断言中文标签和价格；
    - 企业账号 GET/POST/PUT/DELETE developer plans 均返回 403；
    - 开发者 API 创建非法 tier 套餐，断言 400 `INVALID_TIER`；
    - 开发者 API 创建 `FULL + MEDIUM` 受保护套餐，因 demo 企业订阅是 `FULL/MEDIUM`，删除断言 409 `PLAN_HAS_SUBSCRIPTIONS`；
    - 将受保护套餐改成 `MODULE + LARGE` 后删除清理，避免测试数据残留；
    - UI 编辑原套餐并 API 回读验证；
    - UI 删除原套餐并 API 验证消失；
    - 生成截图 `docs/smoke-evidence/开发者套餐生命周期CRUD.png`。

已执行验证：
- Focused real Chrome:
  `BROWSER_SMOKE_DB_PATH=/private/tmp/zlt_browser_smoke_dev_plans.db npx playwright test --config playwright.config.ts -g "platform plan lifecycle"`
  结果：1/1 passed。
- Unified verify:
  `bash scripts/verify.sh`
  结果：backend Prisma generate、backend tests 6 files / 36 tests、backend build、frontend tests 2 files / 36 tests、frontend build 全通过。
- Full real Chrome:
  `bash scripts/browser-smoke.sh`
  结果：18/18 passed。

请重点审查：
1. 你上一轮指出的误删已订阅套餐组合风险是否已被 409 删除保护覆盖。
2. 反向测试是否真实覆盖 409，并且是否清理了临时受保护套餐。
3. 输入校验是否能阻止非法 tier/type 和负数/无效用户数。
4. CRUD + 403 + API 回读是否仍然完整。
5. 是否还有 blocker 或 Product Green 夸大。

输出：
- Verdict: PASS / WARN / FAIL
- Blockers
- Yellow risks
- 建议修复项
