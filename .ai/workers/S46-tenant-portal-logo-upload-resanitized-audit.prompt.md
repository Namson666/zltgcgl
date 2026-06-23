# S46 re-audit_worker: 企业独立登录页 Logo 上传闭环（SVG 已移除）审查

请作为独立审查者，审查当前 git diff 中关于“企业独立登录页 Logo 上传”的实现。

范围：

- `backend/src/modules/developer/routes.ts`
- `frontend/src/api/index.ts`
- `frontend/src/pages/developer/TenantView.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`

本轮修正点：

- 第一轮 Claude 审查 PASS，但提示 SVG Logo 可能带来脚本风险。
- 当前实现已从后端 `fileFilter` 和前端 `accept` 中移除 `image/svg+xml`，只允许 PNG/JPG/WebP。
- Chrome 测试改为上传 `frontend/public/icon.png`。

业务要求：

1. 开发者后台能给企业独立登录页上传 Logo 图片，而不是只能手填 URL。
2. Logo 上传必须是开发者鉴权接口，且归属于目标企业配置操作。
3. 文件类型应限制为安全图片类型 PNG/JPG/WebP，大小应有限制；上传后返回 `/uploads/...` URL。
4. 前端上传成功后自动填入 Logo URL，并显示预览；保存独立登录配置后持久化。
5. 独立登录页应实际使用上传后的 Logo URL 渲染图片。
6. 原统一登录页企业代码登录、模块开关、独立域名登录不应被破坏。

已执行验证：

- `cd frontend && npx playwright test tests/smoke/browser-smoke.spec.ts --grep "developer can configure tenant modules and independent login through UI"`：1/1 通过
- `bash scripts/verify.sh`：第一次在 auth 测试出现非相关不稳定失败，后续需要复跑；前端/Chrome 上传路径已过
- `bash scripts/browser-smoke.sh`：SVG 移除前 35/35 通过；SVG 移除后 focused Chrome 通过
- `code-review-graph build --skip-flows && code-review-graph detect-changes`：risk 0.50，提示前端函数级 test gap，但真实 Chrome 已覆盖上传控件、保存和登录页图片路径

请输出：

- PASS / WARN / FAIL
- 是否有阻塞问题
- 需要优先修复的问题（如果有）
- 可以后续优化但不阻塞的问题

不要修改代码。
