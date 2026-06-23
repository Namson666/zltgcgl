快速审查当前 git diff，结论用 PASS/WARN/FAIL。

范围：
- frontend/src/hooks/useConfigList.ts：保存后保留选中项时刷新表单为服务端真实状态。
- frontend/src/pages/developer/AiConfig.tsx、OcrConfig.tsx：仅新增 data-testid。
- frontend/tests/smoke/browser-smoke.spec.ts：新增 AI/OCR 配置生命周期真实 Chrome 用例。

请确认：
1. AI/OCR 用例覆盖新增、API 回读脱敏、启用/状态重置、删除、企业 403。
2. OCR 测试不依赖真实外部网络；AI 不把真实第三方网络作为通过条件。
3. useConfigList 修复不会泄露敏感字段；AI apiKey 仍按 sensitiveFields 清空。
4. 没有恢复库存预警。

已验证：
- focused Chrome 1/1 passed
- bash scripts/verify.sh passed
- bash scripts/browser-smoke.sh 19/19 passed
- code-review-graph risk 0.50

只输出：结论、Blockers、Yellow risks、是否可提交。
