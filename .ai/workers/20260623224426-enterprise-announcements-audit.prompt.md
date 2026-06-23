请作为独立审查员审查本次企业端公告闭环改动。

范围：
- 新增企业端只读已发布公告 API：`backend/src/modules/announcement/routes.ts`
- `backend/src/app.ts` 新增 `/api/announcements` 和 `/api/v1/announcements`
- `frontend/src/api/index.ts` 新增 `announcementApi.getPublished`
- `frontend/src/pages/Dashboard.tsx` 企业首页展示最近公告
- `frontend/tests/smoke/browser-smoke.spec.ts` 系统公告生命周期真机覆盖增强

重点检查：
1. 企业用户是否只能读取已发布公告，不能读取开发者公告管理接口。
2. 开发者普通 token 是否不能访问企业端公告接口。
3. 未发布/下架/删除公告是否不会出现在企业端。
4. Dashboard 新增公告区域是否不会影响原有统计模块、模块开通逻辑和已删除的库存预警功能。
5. 是否存在明显 TypeScript、权限、分页/limit 或测试遗漏问题。

已跑验证：
- `npm run build` in backend: pass
- `npm run build` in frontend: pass
- focused Chrome: `npx playwright test tests/smoke/browser-smoke.spec.ts --grep "developer can manage announcement lifecycle"`: 1/1 pass
- `bash scripts/verify.sh`: backend tests 57/57, frontend tests 36/36, builds pass
- `bash scripts/browser-smoke.sh`: Chrome 34/34 pass
- `code-review-graph build --skip-flows && code-review-graph detect-changes`: risk 0.50, Dashboard/fetchAnnouncements/type label flagged for review, no affected flows.

请输出：
- 阻塞问题（如有）
- 非阻塞建议（如有）
- 是否认可本次 slice 可提交
