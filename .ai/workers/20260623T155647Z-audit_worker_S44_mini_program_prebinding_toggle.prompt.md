# S44 audit_worker: 默认小程序手机号预绑定启停生命周期审查

请作为独立审查者，审查当前 git diff 中关于“开发者默认小程序手机号预绑定启用/停用”的实现。

范围：

- 后端：`backend/src/modules/developer/routes.ts`
- 前端 API：`frontend/src/api/index.ts`
- 开发者后台页面：`frontend/src/pages/developer/Integrations.tsx`
- 真实浏览器验收：`frontend/tests/smoke/browser-smoke.spec.ts`

业务要求：

1. 开发者可以在后台停用某个默认小程序手机号预绑定。
2. 预绑定停用后，默认小程序无 `tenantId` 的打卡不能继续自动分流到该企业；如果同手机号命中多个企业，应返回 `MULTIPLE_TENANTS`，并且不能写入任何企业打卡记录。
3. 重新启用后，默认小程序无 `tenantId` 的打卡应恢复自动分流到预绑定企业和人员。
4. 只能操作当前开发者自己的预绑定记录。
5. 必须有真实浏览器路径覆盖按钮点击和打卡行为。

已执行验证：

- `cd frontend && npx playwright test tests/smoke/browser-smoke.spec.ts --grep "mini-program check-in does not silently route"`：1/1 通过
- `bash scripts/verify.sh`：通过
- `bash scripts/browser-smoke.sh`：第二轮 35/35 通过
- `code-review-graph build --skip-flows && code-review-graph detect-changes`：risk 0.50，提示前端函数级 test gap，但真实 Chrome 已覆盖按钮路径

请输出：

- PASS / WARN / FAIL
- 是否有阻塞问题
- 需要优先修复的问题（如果有）
- 可以后续优化但不阻塞的问题

不要修改代码。
