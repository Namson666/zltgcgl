请审查下面 diff，判断是否足以证明开发者后台 UI 可配置企业模块开通和独立登录页。输出 PASS/WARN/FAIL；列出 blocker 和 yellow risks；不要调用工具。

diff --git a/frontend/src/pages/developer/TenantView.tsx b/frontend/src/pages/developer/TenantView.tsx
index 125b034..9243600 100644
--- a/frontend/src/pages/developer/TenantView.tsx
+++ b/frontend/src/pages/developer/TenantView.tsx
@@ -442,6 +442,7 @@ const TenantView: React.FC = () => {
                 <button
                   key={mod.key}
                   type="button"
+                  data-testid={mod.configurable ? `tenant-module-toggle-${mod.key}` : undefined}
                   disabled={!mod.configurable}
                   onClick={() => mod.configurable && handleToggleModule(mod.key as TenantModuleState['moduleKey'])}
                   className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors disabled:cursor-default"
@@ -478,7 +479,7 @@ const TenantView: React.FC = () => {
           {/* ==========================================
            * 独立登录页配置
            * ========================================== */}
-          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
+          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6" data-testid="tenant-portal-config">
             <div className="flex items-start justify-between gap-4 mb-4">
               <div>
                 <h2 className="text-base font-semibold" style={{ color: '#1A2B3C' }}>
diff --git a/frontend/tests/smoke/browser-smoke.spec.ts b/frontend/tests/smoke/browser-smoke.spec.ts
index 31ce52f..e3efdbe 100644
--- a/frontend/tests/smoke/browser-smoke.spec.ts
+++ b/frontend/tests/smoke/browser-smoke.spec.ts
@@ -483,6 +483,128 @@ test.describe('browser smoke: authenticated core navigation', () => {
     });
   });
 
+  test('developer can configure tenant modules and independent login through UI', async ({ page }) => {
+    test.setTimeout(120_000);
+    const stamp = Date.now();
+    const tenant = await createSmokeTenant(page, stamp);
+    const portalCompanyName = `UI独立门户企业${stamp}`;
+    const portalTitle = `UI独立门户登录${stamp}`;
+
+    await loginDeveloper(page);
+    await page.goto('/dev/tenants');
+    await expect(page.getByText('企业管理').first()).toBeVisible();
+    await page.getByPlaceholder('搜索企业名称或企业代码...').fill(tenant.tenantName);
+    await page.keyboard.press('Enter');
+    const tenantRow = page.locator('tr', { hasText: tenant.tenantName });
+    await expect(tenantRow).toBeVisible();
+    await tenantRow.getByTitle('进入企业视角').click();
+    await expect(page).toHaveURL(new RegExp(`/dev/tenants/${tenant.tenantId}/view`));
+    await expect(page.getByText(`企业代码: ${tenant.tenantCode}`)).toBeVisible();
+
+    const laborToggle = page.getByTestId('tenant-module-toggle-labor');
+    const financeToggle = page.getByTestId('tenant-module-toggle-finance');
+    const wmsToggle = page.getByTestId('tenant-module-toggle-wms');
+    await expect(wmsToggle).toContainText('已启用');
+    await expect(laborToggle).toContainText('已启用');
+    await expect(financeToggle).toContainText('已启用');
+    await laborToggle.click();
+    await financeToggle.click();
+    await expect(laborToggle).toContainText('未启用');
+    await expect(financeToggle).toContainText('未启用');
+    await page.getByRole('button', { name: '保存模块设置' }).click();
+    await expect(page.getByText('模块开通状态已保存')).toBeVisible();
+
+    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
+    expect(developerToken).toBeTruthy();
+    const modulesResponse = await page.request.get(`/api/developer/tenants/${tenant.tenantId}/modules`, {
+      headers: { Authorization: `Bearer ${developerToken}` },
+    });
+    expect(modulesResponse.status()).toBe(200);
+    const modulesBody = await readJson(modulesResponse);
+    const moduleMap = new Map((modulesBody?.data || []).map((item: any) => [item.moduleKey, item.isEnabled]));
+    expect(moduleMap.get('wms')).toBe(true);
+    expect(moduleMap.get('labor')).toBe(false);
+    expect(moduleMap.get('finance')).toBe(false);
+
+    const portal = page.getByTestId('tenant-portal-config');
+    await portal.locator('input[type="checkbox"]').check();
+    await portal.getByPlaceholder('login.example.com').fill('localhost');
+    const portalTextInputs = portal.locator('input[type="text"]');
+    await portalTextInputs.nth(1).fill(portalCompanyName);
+    await portalTextInputs.nth(2).fill(portalTitle);
+    await portalTextInputs.nth(3).fill('/uploads/ui-portal-logo.png');
+    await portalTextInputs.nth(4).fill('#16A34A');
+    await portal.getByRole('button', { name: '保存独立登录配置' }).click();
+    await expect(page.getByText('独立登录页配置已保存')).toBeVisible();
+
+    const portalResponse = await page.request.get(`/api/developer/tenants/${tenant.tenantId}/portal`, {
+      headers: { Authorization: `Bearer ${developerToken}` },
+    });
+    expect(portalResponse.status()).toBe(200);
+    const portalBody = await readJson(portalResponse);
+    expect(portalBody?.data?.domain).toBe('localhost');
+    expect(portalBody?.data?.companyName).toBe(portalCompanyName);
+    expect(portalBody?.data?.loginTitle).toBe(portalTitle);
+    expect(portalBody?.data?.themeColor).toBe('#16A34A');
+    expect(portalBody?.data?.isEnabled).toBe(true);
+
+    await page.getByRole('button', { name: '退出登录' }).click();
+    await expect(page).toHaveURL(/\/login/);
+    await page.evaluate(() => {
+      window.localStorage.clear();
+      window.sessionStorage.clear();
+    });
+    await page.goto('/login');
+    await page.getByPlaceholder('请输入企业代码').fill(tenant.tenantCode);
+    await page.getByPlaceholder('请输入用户名').fill(tenant.username);
+    await page.getByPlaceholder('请输入密码').fill(tenant.password);
+    await page.getByRole('button', { name: '登 录' }).click();
+    await expect(page).toHaveURL(/\/dashboard/);
+    await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
+    await expect(page.getByText('劳资管理', { exact: true })).toHaveCount(0);
+    await expect(page.getByText('财务管理', { exact: true })).toHaveCount(0);
+
+    await page.goto('/labor/personnel');
+    await expect(page).toHaveURL(/\/dashboard/);
+    await page.goto('/finance/expenses');
+    await expect(page).toHaveURL(/\/dashboard/);
+    await page.goto('/wms/materials');
+    await expect(page).toHaveURL(/\/wms\/materials/);
+    await expect(page.getByRole('heading', { name: '物资总览' })).toBeVisible();
+
+    const userToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
+    expect(userToken).toBeTruthy();
+    const laborResponse = await page.request.get('/api/labor/personnel', {
+      headers: { Authorization: `Bearer ${userToken}` },
+    });
+    expect(laborResponse.status()).toBe(403);
+    const financeResponse = await page.request.get('/api/finance/expenses', {
+      headers: { Authorization: `Bearer ${userToken}` },
+    });
+    expect(financeResponse.status()).toBe(403);
+    const wmsResponse = await page.request.get('/api/wms/inventory', {
+      headers: { Authorization: `Bearer ${userToken}` },
+    });
+    expect(wmsResponse.status()).toBe(200);
+
+    await page.evaluate(() => window.localStorage.clear());
+    await page.goto('http://localhost:5173/login');
+    await expect(page.getByText(portalTitle)).toBeVisible();
+    await expect(page.getByText(`${portalCompanyName} · 独立登录入口`)).toBeVisible();
+    await expect(page.getByPlaceholder('请输入企业代码')).toHaveCount(0);
+    await page.getByPlaceholder('请输入用户名').fill(tenant.username);
+    await page.getByPlaceholder('请输入密码').fill(tenant.password);
+    await page.getByRole('button', { name: '登 录' }).click();
+    await expect(page).toHaveURL(/\/dashboard/);
+    await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
+    await expect(page.getByText('劳资管理', { exact: true })).toHaveCount(0);
+
+    await page.screenshot({
+      path: '../docs/smoke-evidence/开发者UI模块开通独立登录.png',
+      fullPage: true,
+    });
+  });
+
   test('enterprise user can create edit and delete supplier and work team', async ({ page }) => {
     await loginEnterprise(page);
     const stamp = Date.now();
