import { expect, test } from '@playwright/test';
import path from 'path';

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
      if (target.text === '合同管理') {
        await expect(page.getByText('承包合同、合同附件、收款记录')).toBeVisible();
        await page.getByText('采购合同、发票、附件、支付记录').click();
        await page.getByText('分包合同、班组关联、付款/结算凭证').click();
        await page.getByText('承包合同、合同附件、收款记录').click();

        const stamp = Date.now();
        const contractName = `浏览器附件验收合同-${stamp}`;
        await page.getByRole('button', { name: /新增承包合同/ }).click();
        await page.getByPlaceholder('请输入合同名称').fill(contractName);
        await page.getByPlaceholder('请输入合同编号').fill(`E2E-${stamp}`);
        await page.getByPlaceholder('请输入合同总金额').fill('12345');
        await page.getByRole('button', { name: '确认创建' }).click();
        await expect(page.getByText(contractName)).toBeVisible();

        const row = page.locator('tr', { hasText: contractName });
        await row.getByTitle('查看详情').click();
        await expect(page.getByRole('heading', { name: '合同详情' })).toBeVisible();

        const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/contract-attachment.pdf');
        await page.locator('input[type="file"]').setInputFiles(fixturePath);
        await expect(page.getByText('附件上传成功').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'contract-attachment.pdf' })).toBeVisible();

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'contract-attachment.pdf' }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('contract-attachment.pdf');

        await page.getByTitle('删除附件').click();
        await expect(page.getByRole('button', { name: 'contract-attachment.pdf' })).toHaveCount(0);
        await page.getByTitle('关闭').click();

        await page.getByText('采购合同、发票、附件、支付记录').click();
        const procurementName = `浏览器采购验收合同-${stamp}`;
        await page.getByRole('button', { name: /新增采购合同/ }).click();
        await page.getByPlaceholder('请输入合同名称').fill(procurementName);
        await page.getByPlaceholder('请输入合同编号').fill(`PO-E2E-${stamp}`);
        await page.getByPlaceholder('请输入合同总金额').fill('3456');
        await page.locator('select').filter({ hasText: '请选择承包合同' }).selectOption({ label: contractName });
        await page.getByRole('button', { name: '确认创建' }).click();
        await expect(page.getByText(procurementName)).toBeVisible();

        const procurementRow = page.locator('tr', { hasText: procurementName });
        await procurementRow.getByTitle('查看详情').click();
        await expect(page.getByRole('heading', { name: '合同详情' })).toBeVisible();
        await expect(page.getByText(contractName)).toBeVisible();

        await page.getByRole('button', { name: '新增付款' }).click();
        await page.getByPlaceholder('请输入付款金额').fill('1200');
        await page.locator('input[type="date"]').fill('2026-06-22');
        await page.getByRole('button', { name: '确认创建' }).click();
        await expect(page.getByRole('cell', { name: '¥1,200.00' })).toBeVisible();

        const invoicePath = path.resolve(process.cwd(), 'tests/fixtures/procurement-invoice.pdf');
        await page.getByRole('button', { name: '上传发票' }).click();
        await page.locator('input[type="file"]').setInputFiles(invoicePath);
        await expect(page.getByText('附件上传成功').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'procurement-invoice.pdf' })).toBeVisible();
        const invoiceDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'procurement-invoice.pdf' }).click();
        expect((await invoiceDownloadPromise).suggestedFilename()).toBe('procurement-invoice.pdf');
        await page.getByTitle('删除附件').last().click();
        await expect(page.getByRole('button', { name: 'procurement-invoice.pdf' })).toHaveCount(0);

        const voucherPath = path.resolve(process.cwd(), 'tests/fixtures/payment-voucher.pdf');
        await page.getByRole('button', { name: '上传凭证' }).click();
        await page.locator('input[type="file"]').setInputFiles(voucherPath);
        await expect(page.getByText('附件上传成功').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'payment-voucher.pdf' })).toBeVisible();
        const voucherDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'payment-voucher.pdf' }).click();
        expect((await voucherDownloadPromise).suggestedFilename()).toBe('payment-voucher.pdf');
        await page.getByTitle('删除附件').last().click();
        await expect(page.getByRole('button', { name: 'payment-voucher.pdf' })).toHaveCount(0);
        await page.getByTitle('关闭').click();

        await page.getByText('分包合同、班组关联、付款/结算凭证').click();
        const subContractName = `浏览器分包验收合同-${stamp}`;
        await page.getByRole('button', { name: /新增分包合同/ }).click();
        await page.getByPlaceholder('请输入分包合同名称').fill(subContractName);
        await page.getByPlaceholder('请输入合同总金额').fill('2345');
        await page.locator('select').filter({ hasText: '请选择承包合同' }).selectOption({ label: contractName });
        const workTeamSelect = page.locator('select').filter({ hasText: '请选择班组' });
        await expect(workTeamSelect).toBeVisible();
        const workTeamOptionValue = await workTeamSelect.locator('option').nth(1).getAttribute('value');
        expect(workTeamOptionValue).toBeTruthy();
        await workTeamSelect.selectOption(workTeamOptionValue!);
        await page.getByRole('button', { name: '确认创建' }).click();
        await expect(page.getByText(subContractName)).toBeVisible();

        const subContractRow = page.locator('tr', { hasText: subContractName });
        await subContractRow.getByTitle('查看详情').click();
        await expect(page.getByRole('heading', { name: '分包合同详情' })).toBeVisible();
        const subDetailDialog = page.getByLabel('分包合同详情');
        await expect(subDetailDialog.getByText(contractName)).toBeVisible();

        await page.getByRole('button', { name: '新增付款' }).click();
        await page.getByPlaceholder('请输入付款金额').fill('800');
        await page.locator('input[type="date"]').fill('2026-06-22');
        await page.getByRole('button', { name: '确认创建' }).click();
        await expect(page.getByRole('cell', { name: '¥800.00' })).toBeVisible();

        const subVoucherPath = path.resolve(process.cwd(), 'tests/fixtures/payment-voucher.pdf');
        await page.getByRole('button', { name: '上传凭证' }).click();
        await page.locator('input[type="file"]').setInputFiles(subVoucherPath);
        await expect(page.getByText('附件上传成功').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'payment-voucher.pdf' })).toBeVisible();
        const subVoucherDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'payment-voucher.pdf' }).click();
        expect((await subVoucherDownloadPromise).suggestedFilename()).toBe('payment-voucher.pdf');
        await page.getByTitle('删除附件').last().click();
        await expect(page.getByRole('button', { name: 'payment-voucher.pdf' })).toHaveCount(0);

        const settlementPath = path.resolve(process.cwd(), 'tests/fixtures/settlement-voucher.pdf');
        await page.getByRole('button', { name: '上传结算凭证' }).click();
        await page.locator('input[type="file"]').setInputFiles(settlementPath);
        await expect(page.getByText('附件上传成功').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'settlement-voucher.pdf' })).toBeVisible();
        const settlementDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'settlement-voucher.pdf' }).click();
        expect((await settlementDownloadPromise).suggestedFilename()).toBe('settlement-voucher.pdf');
        await page.getByTitle('删除附件').last().click();
        await expect(page.getByRole('button', { name: 'settlement-voucher.pdf' })).toHaveCount(0);
        await page.getByTitle('关闭').click();

        await subContractRow.getByTitle('删除').click();
        await page.getByRole('button', { name: '确认删除' }).click();
        await expect(page.getByText(subContractName)).toHaveCount(0);

        await page.getByText('采购合同、发票、附件、支付记录').click();
        await procurementRow.getByTitle('删除').click();
        await page.getByRole('button', { name: '确认删除' }).click();
        await expect(page.getByText(procurementName)).toHaveCount(0);

        await page.getByText('承包合同、合同附件、收款记录').click();
        await row.getByTitle('删除').click();
        await page.getByRole('button', { name: '确认删除' }).click();
        await expect(page.getByText(contractName)).toHaveCount(0);
      }
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
