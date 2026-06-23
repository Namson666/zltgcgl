# 审查结论：**PASS**（带 3 个 yellow risks）

## 验收对照
- ✅ **创建即发布**：`service.ts` 显式 `isPublished: true, publishedAt: new Date()`
- ✅ **isPublished 兼容**：`getAnnouncementStatus()` 优先 `status`、回退 `isPublished`；类型双可选
- ✅ **表单 testid**：title/type/content 三个 testid 齐全
- ✅ **真实 Chrome 全链路**：创建→列表→编辑→下架→再发布→删除，逐步骤断言 toast + 行内容 + 后端字段
- ✅ **API 每步验证**：用 `developerToken` 拉列表比对 `isPublished`/`publishedAt`/`type`
- ✅ **企业 403 覆盖**：GET / POST / PUT(`/${id}`) / POST(`/${id}/publish`) / DELETE 全部断言 403
- ✅ **再发布 publishedAt 变化**：`firstPublishedAt` 与再发布后的值显式 `not.toBe` 对比

## Yellow risks
1. **`status` 字段成死代码**：后端 `createAnnouncement` 已不再写 `status`，前端 `getAnnouncementStatus` 的 `announcement.status` 分支实际不会触发。若未来清理旧数据，需同步移除 fallback。
2. **`toggle` 端点未做企业 403 测试**：UI 用 `developerApi.toggleAnnouncement` 走 toggle 端点，但测试只验证了显式 `/publish` 端点的 403。如果 toggle 是独立路由且未在 `requireDeveloper` 之内，理论上企业用户可绕过。**建议补一条 `POST /api/developer/announcements/${id}/toggle` 的 403 断言**。
3. **删除确认按钮定位脆弱**：`getByRole('button', { name: '删除' }).last()` 依赖弹窗确认按钮在 DOM 中是最后一个同名按钮。若 DOM 结构变化（同行删除按钮渲染顺序改变）会误点。**建议给确认按钮加 `data-testid="confirm-delete"`**。

## 顺带提一句（非阻塞）
- 截图只在生命周期末尾取一次，失败时无中间证据。可考虑在「下架后」「再发布后」各补一张便于排错。
- 测试未验证"公告是否真的出现在企业用户前端"——发布业务价值闭环留给 enterprise 端测试覆盖即可，但若要更稳，可在企业端也加一条"看到刚发布的公告标题"断言。
