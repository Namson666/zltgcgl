请审查当前 diff：本轮目标是把独立登录页从 localhost/127.0.0.1 验证升级为真实 Host 语义（portal-<stamp>.localhost）。判断是否真正覆盖企业独立域名 Host 识别、是否影响原企业代码登录、是否有阻塞项或 Yellow 风险。输出 PASS/WARN/FAIL，简短。不要调用工具。

diff --git a/frontend/tests/smoke/browser-smoke.spec.ts b/frontend/tests/smoke/browser-smoke.spec.ts
index 10eacb0..a7d4cc9 100644
--- a/frontend/tests/smoke/browser-smoke.spec.ts
+++ b/frontend/tests/smoke/browser-smoke.spec.ts
@@ -153,11 +153,11 @@ async function configureTenantModules(page: any, developerToken: string, tenantI
   expect(body?.success).toBe(true);
 }
 
-async function configureTenantPortal(page: any, developerToken: string, tenantId: string, stamp: number) {
+async function configureTenantPortal(page: any, developerToken: string, tenantId: string, stamp: number, domain = '127.0.0.1') {
   const response = await page.request.put(`/api/developer/tenants/${tenantId}/portal`, {
     headers: { Authorization: `Bearer ${developerToken}` },
     data: {
-      domain: '127.0.0.1',
+      domain,
       companyName: `独立门户验收企业${stamp}`,
       loginTitle: `独立门户验收登录${stamp}`,
       themeColor: '#0ea5e9',
@@ -1660,9 +1660,11 @@ test.describe('browser smoke: authenticated core navigation', () => {
     });
     expect(wmsResponse.status()).toBe(200);
 
-    await configureTenantPortal(page, developerToken, tenant.tenantId, stamp);
+    const portalHost = `portal-${stamp}.localhost`;
+    await configureTenantPortal(page, developerToken, tenant.tenantId, stamp, portalHost);
     await page.evaluate(() => window.localStorage.clear());
-    await page.goto('/login');
+    await page.goto(`http://${portalHost}:5173/login`);
+    await expect(page).toHaveURL(new RegExp(`http://${portalHost}:5173/login`));
     await expect(page.getByText(`独立门户验收登录${stamp}`)).toBeVisible();
     await expect(page.getByText(`独立门户验收企业${stamp} · 独立登录入口`)).toBeVisible();
     await expect(page.getByPlaceholder('请输入企业代码')).toHaveCount(0);
