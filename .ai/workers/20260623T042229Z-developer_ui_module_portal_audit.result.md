# 审查结论：**PASS**（带黄色风险）

## 覆盖度评估

该 diff 由两部分构成：(1) `TenantView.tsx` 添加 `data-testid` 锚点，(2) `browser-smoke.spec.ts` 新增一个完整的 E2E 测试。该测试不是"打勾式"测试，而是一条贯穿 **UI 交互 → 后端 API 持久化 → 运行时权限拦截 → 独立门户样式与登录** 的端到端链条，证据强度足以证明"开发者后台 UI 可配置企业模块开通和独立登录页"。

### 已证明的能力（覆盖矩阵）

| 能力 | 证据 |
|------|------|
| 模块开关 UI 可用 | `tenant-module-toggle-{wms,labor,finance}` 点击 + 文案从"已启用"切到"未启用" |
| 模块状态持久化 | 二次读取 `/api/developer/tenants/:id/modules` 验证 wms=true / labor=false / finance=false |
| 启用状态被运行时拦截 | 用户登录后 `/api/labor/personnel`、`/api/finance/expenses` 返回 403；`/api/wms/inventory` 返回 200 |
| 路由级屏蔽 | 访问 `/labor/personnel`、`/finance/expenses` 重定向到 `/dashboard` |
| 菜单按模块渲染 | 登录后断言"物资管理"可见，"劳资管理"/"财务管理"不可见 |
| 独立登录页 UI 可配置 | 启用 checkbox + domain/companyName/loginTitle/logo/themeColor 全部填值并保存 |
| 独立登录页配置持久化 | 二次读取 `/api/developer/tenants/:id/portal` 校验 `data.{domain,companyName,loginTitle,themeColor,isEnabled}` |
| 独立登录页实际生效 | 访问 `/login` 显示自定义 `loginTitle` 和"独立登录入口"标题，且隐藏企业代码输入框 |
| 独立门户登录后权限一致 | 通过独立门户登录后菜单模块可见性与原登录保持一致 |
| 证据留存 | 截图保存到 `docs/smoke-evidence/开发者UI模块开通独立登录.png` |

---

## Yellow Risks（非阻塞，但建议补强）

### Y-1：输入选择器按位置索引，不按语义
```ts
await portalTextInputs.nth(1).fill(portalCompanyName);
await portalTextInputs.nth(2).fill(portalTitle);
await portalTextInputs.nth(3).fill('/uploads/ui-portal-logo.png);
await portalTextInputs.nth(4).fill('#16A34A');
```
若 `TenantView` 调整 input 顺序或增删字段，测试会沉默地写到错误的字段。**建议**为每个 input 加 `data-testid="portal-field-{domain|companyName|loginTitle|logo|themeColor}"`。

### Y-2：domain 写成 `localhost`，未验证真正的"独立域名"语义
测试把 domain 填成 `localhost` 然后用 `http://localhost:5173/login` 访问，本质上没测跨域/独立域名场景——它验证的是"配置被存储并显示"，不是"独立域名解析生效"。如果产品诉求是"客户访问自有域名看到独立登录页"，这条测试不覆盖 DNS / 反代 / host header 路径。**建议**新增一个独立场景验证 nginx/反向代理按 Host 路由到独立模板。

### Y-3：logo 路径仅做字符串存储，未做有效性校验
`/uploads/ui-portal-logo.png` 是个不存在的路径，测试没验证 logo 真的会渲染（截图里也无法证明图片加载成功——404 会静默）。**建议**断言 `img[src]` 的自然尺寸 > 0 或网络响应 200。

### Y-4：themeColor 仅校验字符串，未断言样式生效
测试只断言 `portalBody.data.themeColor === '#16A34A'`，没断言登录页 `<button>` 或 logo 容器实际计算样式等于该颜色。**建议**加 `evaluate(() => getComputedStyle(el).backgroundColor)`。

### Y-5：缺乏负向 / 边界用例
- 取消 portal 启用 checkbox 后，独立登录页是否回退到默认？
- 启用 portal 但 domain 留空，应被前端/后端拒绝？
- 修改 portal 配置（再次保存）能否覆盖前一次配置？
- 模块开关"全关"是否会阻断企业用户登录？

### Y-6：测试间隔离依赖 `localStorage.clear()`，未清 cookie
Playwright 默认每个 test 共享 context，token 可能在 cookie 中残留。当前测试在登录切换时清理了 localStorage/sessionStorage，但若后端用 `httpOnly` cookie 维持 session，独立门户测试会复用上一个 test 的 session。**建议**用 `test.use({ storageState: { cookies: [], origins: [] } })` 或在 `beforeEach` 显式 `context.clearCookies()`。

### Y-7：测试未覆盖"开发者后台反查独立门户是否被另一企业误用"
未验证"独立 portal 配置只对当前企业生效"。如果 portal 配置的 tenantId 与登录时的 tenantId 不一致，应被拒绝。

### Y-8：`getByText('企业管理')` 与 `getByText(portalTitle)` 都用 first()/字符串包含
若"企业管理"出现在多个 nav 中，`first()` 可能命中错的元素。**建议**加 `data-testid` 收窄。

### Y-9：token 兼容写法掩盖了真实 token 名
```ts
localStorage.getItem('zlt_token') || localStorage.getItem('token')
```
若两个 key 都被某个旧版前端写入且不一致，会拿到错误 token；而且失败信息会让人误以为登录态丢了。**建议**明确 token 存储 key 或一次性在 helper 里处理。

---

## Blocker

**无 blocker**。该 diff 通过"配置 → 持久化 → 拦截 → 独立门户 → 再次校验"完整闭环，足以证明"开发者后台 UI 可配置企业模块开通和独立登录页"。

唯一可上调为 WARN 的点：**Y-2（独立域名语义未验证）**——如果 PRD 把"独立域名"定义为强需求，建议补一个独立场景后再判 PASS；但如果产品当前阶段只要求"独立品牌独立登录页路径"，Y-2 维持 yellow 即可。

---

## 最终判定

| 维度 | 评分 |
|------|------|
| 功能正确性 | ✅ PASS |
| 测试覆盖深度 | ✅ PASS |
| 测试可维护性 | ⚠️ WARN（Y-1, Y-8） |
| 边界 / 负向 | ⚠️ WARN（Y-5） |
| 真实环境假设 | ⚠️ WARN（Y-2, Y-3, Y-4） |
| 测试隔离 | ⚠️ WARN（Y-6, Y-7, Y-9） |

**总评：PASS** —— 提交可合并；yellow risks 建议在下一个迭代里补"独立域名生效 + 边界用例 + 输入语义化" 三个增强测试后再考虑升级到"完全 PASS"。
