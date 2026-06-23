# S46 audit_worker: 企业独立登录页 Logo 上传闭环审查

请作为独立审查者，审查当前 git diff 中关于“企业独立登录页 Logo 上传”的实现。

范围：

- `backend/src/modules/developer/routes.ts`
- `frontend/src/api/index.ts`
- `frontend/src/pages/developer/TenantView.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`

业务要求：

1. 开发者后台能给企业独立登录页上传 Logo 图片，而不是只能手填 URL。
2. Logo 上传必须是开发者鉴权接口，且归属于目标企业配置操作。
3. 文件类型应限制为图片，大小应有限制；上传后返回 `/uploads/...` URL。
4. 前端上传成功后自动填入 Logo URL，并显示预览；保存独立登录配置后持久化。
5. 独立登录页应实际使用上传后的 Logo URL 渲染图片。
6. 原统一登录页企业代码登录、模块开关、独立域名登录不应被破坏。

已执行验证：

- `cd frontend && npx playwright test tests/smoke/browser-smoke.spec.ts --grep "developer can configure tenant modules and independent login through UI"`：1/1 通过
- `bash scripts/verify.sh`：通过
- `bash scripts/browser-smoke.sh`：35/35 通过
- `code-review-graph build --skip-flows && code-review-graph detect-changes`：risk 0.50，提示前端函数级 test gap，但真实 Chrome 已覆盖上传控件、保存和登录页图片路径

请输出：

- PASS / WARN / FAIL
- 是否有阻塞问题
- 需要优先修复的问题（如果有）
- 可以后续优化但不阻塞的问题

不要修改代码。
