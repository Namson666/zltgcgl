## 审查结论：**WARN** ⚠️

### 覆盖性判断
✅ **真正覆盖 Host 语义**：从硬编码 `127.0.0.1` 升级为 `portal-${stamp}.localhost`，浏览器实际以新 Host 访问 `/login`，并用 `toHaveURL` 断言 URL 包含该 Host — 这是真实的企业独立域名模拟（`.localhost` 顶级域按 RFC 6761 自动环回，无需改 hosts）。

### 对原企业代码登录的影响
✅ **无副作用**：仅修改本测试块的 `configureTenantPortal` 调用与导航路径，不触碰其他 describe 块、不改后端路由、不改前端业务组件。原企业代码登录（假设走 query/path）走另一路径，未被波及。

### Yellow 风险（必须验证）

1. **Vite `server.allowedHosts` 拦截**（高概率 blocker）
   Vite 5+ 默认在 dev server 启用 host 校验，非白名单 Host 直接返回 "Blocked request. This host (...) is not allowed."。若配置 `allowedHosts: ['localhost', '127.0.0.1']`，整个测试会在 `page.goto` 阶段直接 400 失败。
   → **必须先确认 vite.config.ts 没启用严格 allowedHosts，或已加入 `.localhost` / `all`。**

2. **后端 CORS 未覆盖新 Origin**（高概率 blocker）
   `page.request.put(/api/developer/...)` 的 Origin 会变成 `http://portal-${stamp}.localhost:5173`。若后端 CORS 白名单只列了 `http://localhost:5173` / `http://127.0.0.1:5173`，所有 API 调用 403。
   → **必须确认后端 CORS 用正则/通配覆盖 `*.localhost`，或测试里手动带 Origin 绕过。**

3. **Cookie / 租户识别作用域**
   若 `tenant` 识别靠 `req.headers.host`，且前端租户上下文 cookie 在 `domain=localhost` 作用域下，跨子域可能丢 cookie 导致 TenantContext 空 → `独立门户验收登录${stamp}` 渲染不出来。
   → 需要看 `hostTenantResolver` 是否基于 host 做精确匹配。

4. **Vite HMR / proxy host**
   Vite proxy 默认按 path 透传，与 Host 无关，OK；但 HMR ws 用当前 Host，一般无碍 — 仅观察。

### 建议下一步
- 先把 vite.config.ts 的 `server.allowedHosts` 调整为 `true` 或加 `.localhost` 通配
- 把后端 CORS `origin` 改为正则 `/^https?:\/\/(portal-[\w-]+\.localhost|localhost|127\.0\.0\.1)(:\d+)?$/`
- 在 CI 实跑一次，截首个失败点确认

**短期可放行，但运行前必须先消掉上述 1、2 两项**，否则必 FAIL。
