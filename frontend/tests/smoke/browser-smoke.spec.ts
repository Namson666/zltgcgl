import { expect, test } from '@playwright/test';

const enterpriseAccount = {
  tenantCode: 'demo',
  username: 'admin',
  password: 'Admin@2024',
};

const developerAccount = {
  username: 'superadmin',
  password: 'Admin@2024',
};

test.describe('browser smoke: authenticated core navigation', () => {
  test('enterprise user can login and open core enabled modules', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('请输入企业代码').fill(enterpriseAccount.tenantCode);
    await page.getByPlaceholder('请输入用户名').fill(enterpriseAccount.username);
    await page.getByPlaceholder('请输入密码').fill(enterpriseAccount.password);
    await page.getByRole('button', { name: '登 录' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('数据看板').first()).toBeVisible();

    const menuTargets = [
      { text: '合同管理', path: '/contracts', url: /\/contracts/ },
      { text: '物资总览', path: '/wms/materials', url: /\/wms\/materials/ },
      { text: '人员管理', path: '/labor/personnel', url: /\/labor\/personnel/ },
      { text: '项目部报账', path: '/finance/dept-entry', url: /\/finance\/dept-entry/ },
      { text: '项目部管理', path: '/departments', url: /\/departments/ },
      { text: '用户管理', path: '/admin/users', url: /\/admin\/users/ },
      { text: '角色权限', path: '/admin/roles', url: /\/admin\/roles/ },
    ];

    for (const target of menuTargets) {
      await page.getByText(target.text, { exact: true }).last().click();
      await expect(page).toHaveURL(target.url);
      await page.screenshot({
        path: `../docs/smoke-evidence/${target.text}.png`,
        fullPage: true,
      });
    }
  });

  test('developer can login and open tenant management', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /开发者登录/ }).click();
    await page.getByPlaceholder('请输入用户名').fill(developerAccount.username);
    await page.getByPlaceholder('请输入密码').fill(developerAccount.password);
    await page.getByRole('button', { name: '登 录' }).click();

    await expect(page).toHaveURL(/\/dashboard|\/dev/);
    await page.goto('/dev/tenants');
    await expect(page.getByText('企业管理').first()).toBeVisible();
    await page.screenshot({
      path: '../docs/smoke-evidence/开发者企业管理.png',
      fullPage: true,
    });
  });
});
