你是独立审查 worker。请审查当前工作树是否满足用户最新要求：“删除库存预警，这个功能不需要了。”

上下文：
- 用户再次明确 WMS 库存预警不需要。
- 库存预警此前应已从产品代码、路由、菜单、API、Prisma 字段、浏览器验收矩阵中删除。
- 本轮主要同步当前状态/交接文件，明确不要把库存预警作为未来重构或验收范围。
- 请不要建议删除劳资风控预警、系统公告 warning 类型、UI warning 样式、人脸识别 threshold，这些不是库存预警。

请检查：
1. `rg -n "库存预警|低库存|预警阈值|alertThreshold|/wms/alerts|Alerts\\.tsx" frontend/src backend/src backend/prisma frontend/tests docs/superpowers docs/*.md REQUIREMENTS.md README.md .ai/session/HANDOFF.md .ai/*.json --glob '!docs/smoke-evidence/**'`
   的结果是否只剩历史状态记录或明确 out-of-scope 说明。
2. 当前业务代码是否有库存预警页面、路由、API 或字段残留。
3. 当前开发者套餐生命周期改动是否意外恢复库存预警。
4. 是否误删/误判非库存预警的风控/警告功能。

输出：
- PASS/WARN/FAIL
- Blockers（如有）
- Yellow risks（如有）
- 简短建议
