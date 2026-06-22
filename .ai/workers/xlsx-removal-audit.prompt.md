你是 audit_worker。请审查本轮 backend 移除 `xlsx` 高危依赖的改动。

上下文：
- `xlsx` 因 no-fix high 漏洞被从 backend 依赖中移除。
- 原 `/api/labor/reports/export` 使用动态 import('xlsx') 生成四张 sheet。
- 现在改为使用已存在的 `exceljs`，保留四张表、文件名和 xlsx 下载响应。

请重点审查：
1. 是否仍有 backend 代码引用 xlsx。
2. ExcelJS 导出是否保持原有四个 worksheet 和下载响应。
3. 是否有类型/运行时明显问题。
4. npm audit 状态是否从 high 降为仅 uuid moderate breaking-force。
5. 是否需要阻塞提交。

输出 PASS/FAIL、BLOCKERS、YELLOW RISKS、建议最小修复。
