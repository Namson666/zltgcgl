# S45 audit_worker: 默认小程序手机号预绑定停用安全确认审查

请作为独立审查者，审查当前 git diff 中关于“默认小程序手机号预绑定停用安全确认与类型收敛”的实现。

范围：

- `frontend/src/pages/developer/Integrations.tsx`
- `frontend/tests/smoke/browser-smoke.spec.ts`

业务背景：

- S44 已实现默认小程序手机号预绑定启用/停用。
- Claude 上一轮 Yellow 建议：停用是高风险操作，建议加确认；`binding: any` 建议改为明确类型。

本轮要求：

1. 停用预绑定前必须弹出确认，提示手机号和影响（不再自动分流）。
2. 用户取消确认时不应调用后端更新。
3. 启用预绑定不需要确认。
4. 前端类型应避免在 `handleTogglePhoneBinding` 和 `phoneBindings` 状态上继续使用 `any`。
5. 真实浏览器测试应覆盖停用确认弹窗，并继续证明停用后返回 MULTIPLE_TENANTS、不写入记录，重新启用后恢复自动分流。

已执行验证：

- `cd frontend && npx playwright test tests/smoke/browser-smoke.spec.ts --grep "mini-program check-in does not silently route"`：1/1 通过
- `bash scripts/verify.sh`：通过
- `bash scripts/browser-smoke.sh`：35/35 通过
- `code-review-graph build --skip-flows && code-review-graph detect-changes`：risk 0.50，提示前端函数级 test gap，但真实 Chrome 已覆盖按钮和弹窗路径

请输出：

- PASS / WARN / FAIL
- 是否有阻塞问题
- 需要优先修复的问题（如果有）
- 可以后续优化但不阻塞的问题

不要修改代码。
