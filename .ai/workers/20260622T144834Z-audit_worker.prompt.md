你是 audit_worker。请审查本轮真实 Chrome 全路由矩阵扩展。

上下文：
- 用户要求最终交付前必须真机/真实浏览器点击所有功能板块。
- 本轮在 `frontend/tests/smoke/browser-smoke.spec.ts` 增加了企业后台全主菜单路由矩阵和开发者后台全主菜单路由矩阵。
- 已运行 `bash scripts/browser-smoke.sh`，结果 4 tests passed；企业 31 个业务路由和开发者 15 个路由都被真实 Chrome 打开并截图。
- 这只是“所有板块能打开”的基础门，不等同于每个页面所有 CRUD/上传下载穷举完成。

请重点审查：
1. 矩阵是否覆盖 Layout/App 中主要企业和开发者菜单路由。
2. 断言是否能防止 404、模块未开通、无权限、页面加载中假绿。
3. 是否存在明显漏掉的用户要求路径。
4. 是否可以作为 Product Green 的全部证据，还是只能作为 Browser Regression 的一部分。

输出 PASS/FAIL、BLOCKERS、YELLOW RISKS、建议下一步最小补强。
