import { expect, test } from '@playwright/test';
import fs from 'fs';
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

const enterpriseRouteMatrix = [
  ['数据看板', '/dashboard'],
  ['合同管理', '/contracts'],
  ['物资总览', '/wms/materials'],
  ['入库管理', '/wms/inbound'],
  ['出库管理', '/wms/outbound'],
  ['退库管理', '/wms/returns'],
  ['物资借调', '/wms/transfers'],
  ['班组台账', '/wms/ledger'],
  ['人员管理', '/labor/personnel'],
  ['考勤管理', '/labor/attendance'],
  ['工资核算', '/labor/salary'],
  ['工资发放', '/labor/payment'],
  ['风控管理', '/labor/risk'],
  ['报表导出', '/labor/reports'],
  ['项目部报账', '/finance/dept-entry'],
  ['公司财务凭证', '/finance/finance-entry'],
  ['备用金管理', '/finance/petty-cash'],
  ['费用列表', '/finance/expenses'],
  ['开票记录', '/finance/invoices'],
  ['收款记录', '/finance/receipts'],
  ['合同盈利分析', '/finance/contract-pnl'],
  ['财务看板', '/finance/dashboard'],
  ['类别设置', '/finance/settings'],
  ['台账导入', '/finance/import'],
  ['项目部管理', '/departments'],
  ['用户管理', '/admin/users'],
  ['角色权限', '/admin/roles'],
  ['供应商管理', '/admin/suppliers'],
  ['班组管理', '/admin/work-teams'],
  ['回收站', '/admin/recycle-bin'],
  ['订阅计划', '/subscription'],
] as const;

const developerRouteMatrix = [
  ['综合看板', '/dev'],
  ['企业管理', '/dev/tenants'],
  ['套餐订阅', '/dev/plans'],
  ['支付记录', '/dev/payments'],
  ['发票管理', '/dev/invoices'],
  ['AI 模型配置', '/dev/ai-config'],
  ['OCR 配置', '/dev/ocr-config'],
  ['第三方集成', '/dev/integrations'],
  ['存储管理', '/dev/storage'],
  ['API 密钥', '/dev/api-keys'],
  ['系统公告', '/dev/announcements'],
  ['安全策略', '/dev/security'],
  ['系统监控', '/dev/monitoring'],
  ['系统配置', '/dev/system-config'],
  ['操作日志', '/dev/logs'],
] as const;

async function loginEnterprise(page: any) {
  await page.goto('/login');
  await page.getByPlaceholder('请输入企业代码').fill(enterpriseAccount.tenantCode);
  await page.getByPlaceholder('请输入用户名').fill(enterpriseAccount.username);
  await page.getByPlaceholder('请输入密码').fill(enterpriseAccount.password);
  await page.getByRole('button', { name: '登 录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function loginDeveloper(page: any) {
  await page.goto('/login');
  await page.getByRole('button', { name: /开发者登录/ }).click();
  await page.getByPlaceholder('请输入用户名').fill(developerAccount.username);
  await page.getByPlaceholder('请输入密码').fill(developerAccount.password);
  await page.getByRole('button', { name: '登 录' }).click();
  await expect(page).toHaveURL(/\/dashboard|\/dev/);
}

async function readJson(response: any) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function createSmokeTenant(page: any, stamp: number) {
  const password = 'Admin@2024';
  const username = `portal_admin_${stamp}`;
  const phone = `136${String(stamp).slice(-8)}`;
  const response = await page.request.post('/api/auth/register', {
    data: {
      companyName: `模块开通验收企业${stamp}`,
      contactName: '模块开通验收管理员',
      phone,
      username,
      password,
    },
  });
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  expect(body?.success).toBe(true);
  expect(body?.data?.tenant?.id).toBeTruthy();
  return {
    tenantId: body.data.tenant.id as string,
    tenantCode: body.data.tenant.code as string,
    tenantName: body.data.tenant.name as string,
    username,
    password,
  };
}

async function getDeveloperToken(page: any) {
  const response = await page.request.post('/api/auth/developer/login', {
    data: developerAccount,
  });
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  expect(body?.data?.token).toBeTruthy();
  return body.data.token as string;
}

async function configureTenantModules(page: any, developerToken: string, tenantId: string, enabled: { wms: boolean; labor: boolean; finance: boolean }) {
  const response = await page.request.put(`/api/developer/tenants/${tenantId}/modules`, {
    headers: { Authorization: `Bearer ${developerToken}` },
    data: {
      modules: [
        { moduleKey: 'wms', isEnabled: enabled.wms, remark: 'browser smoke module entitlement' },
        { moduleKey: 'labor', isEnabled: enabled.labor, remark: 'browser smoke module entitlement' },
        { moduleKey: 'finance', isEnabled: enabled.finance, remark: 'browser smoke module entitlement' },
      ],
    },
  });
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  expect(body?.success).toBe(true);
}

async function configureTenantPortal(page: any, developerToken: string, tenantId: string, stamp: number) {
  const response = await page.request.put(`/api/developer/tenants/${tenantId}/portal`, {
    headers: { Authorization: `Bearer ${developerToken}` },
    data: {
      domain: '127.0.0.1',
      companyName: `独立门户验收企业${stamp}`,
      loginTitle: `独立门户验收登录${stamp}`,
      themeColor: '#0ea5e9',
      isEnabled: true,
    },
  });
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  expect(body?.success).toBe(true);
}

async function expectUsablePage(page: any, label: string, route: string) {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('body')).not.toContainText('页面加载中');
  await expect(page.locator('body')).not.toContainText('页面不存在');
  await expect(page.locator('body')).not.toContainText('未开通');
  await expect(page.locator('body')).not.toContainText('无权限');
  await expect(page.getByRole('main')).toBeVisible();
  await page.screenshot({
    path: `../docs/smoke-evidence/full-route-${label.replace(/[\\/:*?"<>|\\s]+/g, '-')}.png`,
    fullPage: true,
  });
}

async function selectFirstRealOption(selectLocator: any) {
  const optionCount = await selectLocator.locator('option').count();
  expect(optionCount).toBeGreaterThan(1);
  const value = await selectLocator.locator('option').nth(1).getAttribute('value');
  expect(value).toBeTruthy();
  await selectLocator.selectOption(value!);
}

async function chooseMultiSelectModalOption(page: any, openerText: string | RegExp, modalTitle: string | RegExp, optionText: string | RegExp) {
  await page.locator('button').filter({ hasText: openerText }).first().click();
  await expect(page.getByRole('heading', { name: modalTitle })).toBeVisible();
  const dialog = page.locator('.fixed').filter({ hasText: modalTitle }).last();
  await dialog.locator('label', { hasText: optionText }).first().click();
  await dialog.getByRole('button', { name: '确认' }).click();
}

async function chooseSingleSelectModalOption(page: any, openerText: string | RegExp, modalTitle: string | RegExp, optionText: string | RegExp) {
  await page.locator('button').filter({ hasText: openerText }).first().click();
  await expect(page.getByRole('heading', { name: modalTitle })).toBeVisible();
  const dialog = page.locator('.fixed').filter({ hasText: modalTitle }).last();
  await dialog.getByRole('button', { name: optionText }).first().click();
}

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
	      if (target.text === '人员管理') {
	        const stamp = Date.now();
	        const personName = `浏览器打卡验收-${stamp}`;
	        const phone = `139${String(stamp).slice(-8)}`;
	        const facePath = path.resolve(process.cwd(), 'tests/fixtures/checkin-face.svg');
	        const faceBuffer = fs.readFileSync(facePath);

	        await page.getByRole('button', { name: /新增项目部人员/ }).click();
	        await page.getByPlaceholder('姓名', { exact: true }).fill(personName);
	        await page.getByPlaceholder('联系电话').fill(phone);
	        await page.getByPlaceholder('18位身份证号').fill('110101199001011237');
	        await page.locator('input[type="date"]').fill('2026-06-22');
	        const deptSelect = page.locator('select').filter({ hasText: '请选择项目部' });
	        const deptValue = await deptSelect.locator('option').nth(1).getAttribute('value');
	        expect(deptValue).toBeTruthy();
	        await deptSelect.selectOption(deptValue!);
	        await page.getByRole('button', { name: '保存' }).click();
	        await expect(page.getByText(personName)).toBeVisible();

	        const personRow = page.locator('tr', { hasText: personName });
	        await personRow.getByTitle('查看详情').click();
	        await expect(page.getByRole('heading', { name: new RegExp(`人员详情 — ${personName}`) })).toBeVisible();
	        await page.getByRole('button', { name: '上传人脸照片' }).click();
	        await page.locator('input[type="file"]').setInputFiles(facePath);
	        await expect(page.getByText('已录入人脸照片')).toBeVisible({ timeout: 10000 });
	        await page.getByTitle('关闭').click();

	        await page.getByText('考勤管理', { exact: true }).last().click();
	        await expect(page).toHaveURL(/\/labor\/attendance/);
	        await expect(page.getByRole('heading', { name: '小程序打卡', exact: true })).toBeVisible();
	        await page.locator('select').filter({ hasText: '每天一次' }).selectOption('2');
	        await page.locator('select').filter({ hasText: '本地测试 / Stub' }).selectOption('http');
	        await page.getByRole('button', { name: '保存打卡规则' }).click();
	        await expect(page.getByText('小程序打卡规则已保存')).toBeVisible();
	        await page.locator('select').filter({ hasText: '本地测试 / Stub' }).selectOption('stub');
	        await page.getByRole('button', { name: '保存打卡规则' }).click();
	        await expect(page.getByText('小程序打卡规则已保存')).toBeVisible();

	        const postCheckIn = async (checkDate: string, county: string) => {
	          const response = await page.request.post('/api/mobile/check-in', {
	            multipart: {
	              appId: 'wx_dev_default_checkin',
	              phone,
	              checkDate,
	              latitude: '22.5431',
	              longitude: '114.0579',
	              province: '广东省',
	              city: '深圳市',
	              county,
	              address: `广东省深圳市${county}测试打卡点`,
	              photo: { name: 'checkin-face.svg', mimeType: 'image/svg+xml', buffer: faceBuffer },
	            },
	          });
	          expect(response.status()).toBe(201);
	        };

	        await postCheckIn('2026-06-22', '南山区');
	        await postCheckIn('2026-06-22', '宝安区');
	        await postCheckIn('2026-06-23', '宝安区');
	        await page.getByRole('button', { name: '刷新打卡记录' }).click();
	        await expect(page.getByText(personName).first()).toBeVisible();
	        await expect(page.getByRole('link', { name: '查看照片' }).first()).toBeVisible();
	        await expect(page.getByText('异常').first()).toBeVisible();

	        await page.locator('tbody tr', { hasText: '异常' }).first().locator('input[type="checkbox"]').check();
	        await page.getByRole('button', { name: '批量处理异常' }).click();
	        await expect(page.getByText('异常打卡已批量处理')).toBeVisible();
	        await expect(page.getByRole('button', { name: '加入个人信任地' }).first()).toBeVisible();
	        await page.getByRole('button', { name: '加入个人信任地' }).first().click();
	        await expect(page.getByText('已添加为个人信任打卡地')).toBeVisible();
	        await expect(page.getByText(`${personName} · 广东省深圳市宝安区`)).toBeVisible();
	        await page.getByTitle('删除信任地').click();
	        await expect(page.getByText('个人信任打卡地已删除')).toBeVisible();
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
	    await page.goto('/dev/integrations');
	    const defaultMiniProgram = page.getByTestId('default-mini-program-config');
	    await expect(defaultMiniProgram.getByText('开发者默认打卡小程序')).toBeVisible();
	    await defaultMiniProgram.getByTestId('default-mini-program-app-id').fill(`wx_smoke_default_${Date.now()}`);
	    await defaultMiniProgram.getByRole('button', { name: '保存默认小程序配置' }).click();
	    await expect(page.getByText('开发者默认小程序配置已保存')).toBeVisible();

	    await page.goto('/dev/tenants');
	    await expect(page.getByText('企业管理').first()).toBeVisible();
	    await page.locator('tr', { hasText: '演示建筑工程有限公司' }).getByTitle('进入企业视角').click();
	    const tenantMiniProgram = page.getByTestId('tenant-mini-program-config');
	    await expect(tenantMiniProgram.getByText('企业小程序接入')).toBeVisible();
	    await tenantMiniProgram.getByTestId('tenant-mini-program-app-id').fill(`wx_smoke_tenant_${Date.now()}`);
	    await tenantMiniProgram.getByRole('button', { name: '保存企业小程序配置' }).click();
	    await expect(page.getByText('企业小程序接入配置已保存')).toBeVisible();
	    await page.screenshot({
	      path: '../docs/smoke-evidence/开发者企业管理.png',
      fullPage: true,
    });
  });

  test('enterprise user can create edit and delete supplier and work team', async ({ page }) => {
    await loginEnterprise(page);
    const stamp = Date.now();

    const supplierName = `浏览器供应商-${stamp}`;
    const supplierNameEdited = `${supplierName}-已编辑`;
    await page.goto('/admin/suppliers');
    await expect(page.getByRole('heading', { name: '供应商管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增供应商' }).click();
    await page.getByPlaceholder('请输入供应商名称').fill(supplierName);
    await page.getByPlaceholder('请输入联系人姓名').fill('验收联系人');
    await page.getByPlaceholder('请输入联系电话').fill('13800138000');
    await page.getByPlaceholder('请输入供应商地址').fill('深圳市南山区验收地址');
    await page.getByPlaceholder('请输入开户行名称').fill('验收银行');
    await page.getByRole('button', { name: '创建供应商' }).click();
    await expect(page.getByText('供应商创建成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: supplierName })).toBeVisible();

    await page.locator('tr', { hasText: supplierName }).getByTitle('编辑供应商').click();
    await page.getByPlaceholder('请输入供应商名称').fill(supplierNameEdited);
    await page.getByPlaceholder('请输入联系人姓名').fill('验收联系人已编辑');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('供应商信息已更新')).toBeVisible();
    await expect(page.locator('tr', { hasText: supplierNameEdited })).toBeVisible();
    await expect(page.locator('tr', { hasText: supplierNameEdited }).getByText('验收联系人已编辑')).toBeVisible();

    await page.locator('tr', { hasText: supplierNameEdited }).getByTitle('删除供应商').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('供应商已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: supplierNameEdited })).toHaveCount(0);

    const workTeamName = `浏览器班组-${stamp}`;
    const workTeamNameEdited = `${workTeamName}-已编辑`;
    await page.goto('/admin/work-teams');
    await expect(page.getByRole('heading', { name: '班组管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增班组' }).click();
    await page.getByPlaceholder('请输入班组名称').fill(workTeamName);
    await page.getByPlaceholder('请输入班组长姓名').fill('验收班组长');
    await page.getByPlaceholder('请输入联系电话').fill('13900139000');
    await page.getByPlaceholder('请输入班组人数').fill('8');
    await page.getByRole('button', { name: '创建班组' }).click();
    await expect(page.getByText('班组创建成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: workTeamName })).toBeVisible();
    await page.getByPlaceholder('搜索班组名称...').fill('验收班组长');
    await page.keyboard.press('Enter');
    await expect(page.locator('tr', { hasText: workTeamName })).toBeVisible();

    await page.locator('tr', { hasText: workTeamName }).getByTitle('编辑班组').click();
    await page.getByPlaceholder('请输入班组名称').fill(workTeamNameEdited);
    await page.getByPlaceholder('请输入班组长姓名').fill('验收班组长已编辑');
    await page.getByPlaceholder('请输入班组人数').fill('12');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('班组信息已更新')).toBeVisible();
    await expect(page.locator('tr', { hasText: workTeamNameEdited })).toBeVisible();
    await expect(page.locator('tr', { hasText: workTeamNameEdited }).getByText('验收班组长已编辑')).toBeVisible();
    await expect(page.locator('tr', { hasText: workTeamNameEdited }).getByText('12 人')).toBeVisible();

    await page.locator('tr', { hasText: workTeamNameEdited }).getByTitle('删除班组').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('班组已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: workTeamNameEdited })).toHaveCount(0);

    await page.screenshot({
      path: '../docs/smoke-evidence/供应商班组CRUD.png',
      fullPage: true,
    });
  });

  test('enterprise user can complete wms inbound outbound return transfer chain', async ({ page }) => {
    test.setTimeout(150_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const supplierName = `浏览器物资供应商-${stamp}`;
    const materialName = `浏览器钢筋-${stamp}`;
    const projectName = `浏览器项目-${stamp}`;
    const inboundRemark = `真实浏览器入库-${stamp}`;
    const outboundRemark = `真实浏览器出库-${stamp}`;
    const returnRemark = `真实浏览器退库-${stamp}`;
    const transferRemark = `真实浏览器调拨-${stamp}`;

    await page.goto('/wms/inbound');
    await expect(page.getByRole('heading', { name: '入库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增入库' }).click();
    await page.getByPlaceholder('输入供应商名称').fill(supplierName);
    await page.locator('select').filter({ hasText: '不选择项目部' }).selectOption({ label: '第一项目部' });
    await page.getByPlaceholder('选填').fill(inboundRemark);
    await page.getByPlaceholder('输入物资名称').fill(materialName);
    await page.getByPlaceholder('单位').fill('吨');
    await page.getByPlaceholder('项目名称').fill(projectName);
    await page.getByPlaceholder('数量').fill('8');
    await page.getByPlaceholder('实收').fill('8');
    await page.getByPlaceholder('单价').fill('3200');
    await page.getByRole('button', { name: '确认入库' }).click();
    await expect(page.getByText('入库登记成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: supplierName })).toBeVisible();
    await page.locator('tr', { hasText: supplierName }).getByTitle('查看明细').click();
    await expect(page.getByRole('heading', { name: '入库明细' })).toBeVisible();
    await expect(page.getByText(materialName)).toBeVisible();
    await page.getByRole('button').filter({ has: page.locator('svg') }).last().click();

    await page.goto('/wms/outbound');
    await expect(page.getByRole('heading', { name: '出库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增出库' }).click();
    await chooseMultiSelectModalOption(page, '请选择项目部', /选择项目部/, '第一项目部');
    await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
    await selectFirstRealOption(page.locator('select').filter({ hasText: '请选择班组' }));
    await page.getByPlaceholder('可选').fill(outboundRemark);
    const outboundMaterialRow = page.locator('tr', { hasText: materialName }).first();
    await outboundMaterialRow.locator('input[type="checkbox"]').check();
    await outboundMaterialRow.locator('input[type="number"]').fill('3');
    await page.getByRole('button', { name: /确认出库/ }).click();
    await expect(page.getByRole('heading', { name: '出库成功' })).toBeVisible();
    const outboundDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /下载出库单 PDF/ }).click();
    const outboundDownload = await outboundDownloadPromise;
    expect(outboundDownload.suggestedFilename()).toMatch(/^出库单-.*\.pdf$/);
    await page.getByRole('button', { name: '返回继续出库' }).click();
    await expect(page.getByRole('heading', { name: '出库管理' })).toBeVisible();
    await expect(page.locator('tr', { hasText: outboundRemark })).toBeVisible();

    await page.goto('/wms/returns');
    await expect(page.getByRole('heading', { name: '退库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增退库' }).click();
    await page.locator('select').filter({ hasText: '请选择子项目' }).selectOption({ label: projectName });
    await page.getByPlaceholder('可选').fill(returnRemark);
    await page.getByRole('button', { name: /查询领料记录/ }).click();
    await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
    const returnMaterialRow = page.locator('tr', { hasText: materialName }).first();
    await returnMaterialRow.locator('input[type="checkbox"]').check();
    await returnMaterialRow.locator('input[type="number"]').fill('1');
    await page.getByRole('button', { name: /确认退库/ }).click();
    await expect(page.getByText('退库成功')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('tr', { hasText: returnRemark })).toBeVisible();

    await page.goto('/wms/transfers');
    await expect(page.getByRole('heading', { name: '物资调拨' })).toBeVisible();
    await page.getByRole('button', { name: '新增调拨' }).click();
    await chooseMultiSelectModalOption(page, '请选择项目部', /选择调出项目部/, '第一项目部');
    await chooseSingleSelectModalOption(page, '请选择项目部', /选择调入项目部/, '第二项目部');
    await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('可选').fill(transferRemark);
    const transferMaterialRow = page.locator('tr', { hasText: materialName }).first();
    await transferMaterialRow.locator('input[type="checkbox"]').check();
    await transferMaterialRow.locator('input[type="number"]').fill('1');
    await page.getByRole('button', { name: /确认调拨/ }).click();
    await expect(page.getByText('调拨成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: transferRemark })).toBeVisible();
    const transferDownloadPromise = page.waitForEvent('download');
    await page.locator('tr', { hasText: transferRemark }).getByTitle('下载调拨单').click();
    const transferDownload = await transferDownloadPromise;
    expect(transferDownload.suggestedFilename()).toMatch(/^调拨单-.*\.pdf$/);

    await page.goto('/wms/ledger');
    await expect(page.getByRole('heading', { name: '班组台账' })).toBeVisible();
    await page.getByPlaceholder('搜索班组/物资名称...').fill(materialName);
    await expect(page.locator('tr', { hasText: materialName })).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: '../docs/smoke-evidence/物资主链路CRUD.png',
      fullPage: true,
    });
  });

  test('enterprise user can manage roles users and departments', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const stamp = Date.now();

    const roleKey = `smoke_role_${stamp}`;
    const roleName = `浏览器角色-${stamp}`;
    const roleNameEdited = `${roleName}-已编辑`;
    await page.goto('/admin/roles');
    await expect(page.getByRole('heading', { name: '角色权限' })).toBeVisible();
    await page.getByRole('button', { name: '新增角色' }).click();
    await page.getByPlaceholder('英文标识，如 admin、operator').fill(roleKey);
    await page.getByPlaceholder('中文显示名称，如 系统管理员').fill(roleName);
    await page.getByPlaceholder('可选的角色描述').fill('真实浏览器角色 CRUD 验收');
    await page.getByRole('button', { name: '创建角色' }).click();
    await expect(page.getByText('角色已创建')).toBeVisible();
    await expect(page.getByText(roleName)).toBeVisible();

    const roleCard = page.locator('.card', { hasText: roleName }).last();
    await roleCard.getByTitle('编辑角色').click();
    await page.getByPlaceholder('中文显示名称，如 系统管理员').fill(roleNameEdited);
    await page.getByPlaceholder('可选的角色描述').fill('真实浏览器角色编辑验收');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('角色已更新')).toBeVisible();
    await expect(page.getByText(roleNameEdited)).toBeVisible();

    const editedRoleCard = page.locator('.card', { hasText: roleNameEdited }).last();
    await editedRoleCard.click();
    await expect(page.getByRole('button', { name: '保存权限' })).toBeVisible();
    await page.locator('label', { hasText: '全选' }).first().click();
    await page.getByRole('button', { name: '保存权限' }).click();
    await expect(page.getByText('权限配置已保存')).toBeVisible();
    await page.locator('.card', { hasText: roleNameEdited }).last().getByTitle('删除角色').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText(`已删除角色「${roleNameEdited}」`)).toBeVisible();
    await expect(page.getByText(roleNameEdited)).toHaveCount(0);

    const username = `smoke_user_${stamp}`;
    const realName = `浏览器用户-${stamp}`;
    const realNameEdited = `${realName}-已编辑`;
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增用户' }).click();
    await page.getByPlaceholder('请输入用户名').fill(username);
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Admin@2024');
    await page.getByPlaceholder('请输入真实姓名').fill(realName);
    await page.getByPlaceholder('请输入手机号码').fill(`137${String(stamp).slice(-8)}`);
    const roleSelect = page.locator('select').filter({ hasText: '请选择角色' });
    const roleValue = await roleSelect.locator('option').nth(1).getAttribute('value');
    expect(roleValue).toBeTruthy();
    await roleSelect.selectOption(roleValue!);
    await page.getByRole('button', { name: '创建用户' }).click();
    await expect(page.getByText('用户创建成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: username })).toBeVisible();

    const userRow = page.locator('tr', { hasText: username });
    await userRow.getByTitle('编辑用户').click();
    await page.getByPlaceholder('请输入真实姓名').fill(realNameEdited);
    await page.getByPlaceholder('请输入手机号码').fill(`138${String(stamp).slice(-8)}`);
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('用户信息已更新')).toBeVisible();
    await expect(page.locator('tr', { hasText: realNameEdited })).toBeVisible();

    const editedUserRow = page.locator('tr', { hasText: username });
    await editedUserRow.getByTitle('重置密码').click();
    await page.getByPlaceholder('请输入新密码（至少6位）').fill('NewPass@2026');
    await page.getByRole('button', { name: '确认重置' }).click();
    await expect(page.getByText(new RegExp(`已重置用户 "${realNameEdited}" 的密码`))).toBeVisible();
    await editedUserRow.getByTitle('停用用户').click();
    await page.getByRole('button', { name: '确认停用' }).click();
    await expect(page.getByText(new RegExp(`已停用用户 "${realNameEdited}"`))).toBeVisible();
    await page.locator('tr', { hasText: username }).getByTitle('启用用户').click();
    await page.getByRole('button', { name: '确认启用' }).click();
    await expect(page.getByText(new RegExp(`已启用用户 "${realNameEdited}"`))).toBeVisible();

    const deptName = `浏览器项目部-${stamp}`;
    const deptNameEdited = `${deptName}-已编辑`;
    const deptCode = `D${String(stamp).slice(-8)}`;
    await page.goto('/departments');
    await expect(page.getByRole('heading', { name: '项目部管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增项目部' }).click();
    await page.getByPlaceholder('请输入项目部名称').fill(deptName);
    await page.getByPlaceholder('请输入项目部编号').fill(deptCode);
    await page.getByPlaceholder('请输入项目部描述（选填）').fill('真实浏览器项目部 CRUD 验收');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expect(page.getByText('项目部创建成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: deptName })).toBeVisible();

    await page.locator('tr', { hasText: deptName }).getByTitle('编辑').click();
    await page.getByPlaceholder('请输入项目部名称').fill(deptNameEdited);
    await page.getByPlaceholder('请输入项目部描述（选填）').fill('真实浏览器项目部编辑验收');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('项目部更新成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: deptNameEdited })).toBeVisible();

    await page.locator('tr', { hasText: deptNameEdited }).getByTitle('查看详情').click();
    await expect(page.getByRole('heading', { name: '项目部详情' })).toBeVisible();
    const subProjectName = `浏览器子项目-${stamp}`;
    const subProjectNameEdited = `${subProjectName}-已编辑`;
    await page.getByRole('button', { name: '新增子项目' }).click();
    await page.getByPlaceholder('请输入子项目名称').fill(subProjectName);
    await page.getByPlaceholder('请输入子项目编号（选填）').fill(`SP${String(stamp).slice(-6)}`);
    await page.getByPlaceholder('请输入子项目描述（选填）').fill('真实浏览器子项目验收');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expect(page.getByText('子项目创建成功')).toBeVisible();
    await expect(page.getByText(subProjectName)).toBeVisible();
    await page.locator('tr', { hasText: subProjectName }).getByTitle('编辑子项目').click();
    await page.getByPlaceholder('请输入子项目名称').fill(subProjectNameEdited);
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('子项目更新成功')).toBeVisible();
    await expect(page.getByText(subProjectNameEdited)).toBeVisible();

    await page.getByRole('button', { name: '添加成员' }).click();
    const memberSelect = page.locator('select').filter({ hasText: '请选择要添加的用户' });
    await memberSelect.selectOption({ label: `${realNameEdited}（${username}）` });
    await page.getByRole('button', { name: '确认添加' }).click();
    await expect(page.getByText('成员添加成功')).toBeVisible();
    await expect(page.getByText(username)).toBeVisible();
    await page.locator('tr', { hasText: username }).getByTitle('移除成员').click();
    await page.getByRole('button', { name: '确认移除' }).click();
    await expect(page.getByText('成员已移除')).toBeVisible();
    await expect(page.locator('tr', { hasText: username })).toHaveCount(0);
    await page.getByTitle('关闭').click();

    await page.locator('tr', { hasText: deptNameEdited }).getByTitle('停用').click();
    await page.getByRole('button', { name: '确认停用' }).click();
    await expect(page.getByText('项目部已停用')).toBeVisible();
    await page.locator('tr', { hasText: deptNameEdited }).getByTitle('启用').click();
    await page.getByRole('button', { name: '确认启用' }).click();
    await expect(page.getByText('项目部已启用')).toBeVisible();

    await page.screenshot({
      path: '../docs/smoke-evidence/基础后台CRUD.png',
      fullPage: true,
    });
  });

  test('enterprise user can download labor salary payment and report exports', async ({ page }) => {
    await loginEnterprise(page);
    const stamp = Date.now();
    const month = '2026-06';
    const recipientName = `浏览器发放导出-${stamp}`;
    const idCardNo = `110101199001${String(stamp).slice(-6)}`;

    await page.goto('/labor/payment');
    await expect(page.getByRole('heading', { name: '工资发放' })).toBeVisible();
    await page.getByRole('button', { name: '新增发放' }).click();
    await page.getByPlaceholder('收款人姓名').fill(recipientName);
    await page.getByPlaceholder('18位身份证号').fill(idCardNo);
    await page.getByPlaceholder('0.00').fill('88.66');
    await page.locator('input[type="month"]').fill(month);
    await page.getByPlaceholder('银行卡号').fill('6222020202020202020');
    await page.getByPlaceholder('备注').fill('真实浏览器工资发放导出验收');
    await page.getByRole('button', { name: '确认发放' }).click();
    await expect(page.getByText('发放记录创建成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: recipientName })).toBeVisible();

    const paymentDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出', exact: true }).click();
    const paymentDownload = await paymentDownloadPromise;
    expect(paymentDownload.suggestedFilename()).toBe('工资发放明细.xlsx');
    await expect(page.getByText('工资发放明细已导出')).toBeVisible();

    await page.goto('/labor/salary');
    await expect(page.getByRole('heading', { name: '工资核算' })).toBeVisible();
    await page.locator('input[type="month"]').fill(month);
    const salaryDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出报表/ }).click();
    const salaryDownload = await salaryDownloadPromise;
    expect(salaryDownload.suggestedFilename()).toBe(`${month}工资核算明细.xlsx`);
    await expect(page.getByText('工资核算报表已导出')).toBeVisible();

    await page.goto('/labor/reports');
    await expect(page.getByRole('heading', { name: '报表导出' })).toBeVisible();
    const monthSelect = page.locator('select').first();
    await expect(monthSelect.locator(`option[value="${month}"]`)).toHaveCount(1, { timeout: 10000 });
    await monthSelect.selectOption(month);
    await expect(monthSelect).toHaveValue(month);
    await page.locator('select').nth(1).selectOption('payment');
    await expect(page.getByText(new RegExp(`${month} 工资发放明细表`))).toBeVisible();
    await expect(page.getByText(recipientName)).toBeVisible({ timeout: 10000 });
    const reportDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出 Excel/ }).click();
    const reportDownload = await reportDownloadPromise;
    expect(reportDownload.suggestedFilename()).toBe(`${month}-工资发放明细表.xlsx`);

    await page.screenshot({
      path: '../docs/smoke-evidence/劳资工资发放导出.png',
      fullPage: true,
    });
  });

  test('enterprise user can open every enabled business route', async ({ page }) => {
    await loginEnterprise(page);
    for (const [label, route] of enterpriseRouteMatrix) {
      await expectUsablePage(page, label, route);
    }
  });

  test('developer can open every developer route', async ({ page }) => {
    await loginDeveloper(page);
    for (const [label, route] of developerRouteMatrix) {
      await expectUsablePage(page, label, route);
    }
  });

  test('module entitlements hide disabled modules and portal login works without tenant code', async ({ page }) => {
    const stamp = Date.now();
    const tenant = await createSmokeTenant(page, stamp);
    const developerToken = await getDeveloperToken(page);
    await configureTenantModules(page, developerToken, tenant.tenantId, { wms: true, labor: false, finance: false });

    await page.goto('/login');
    await page.getByPlaceholder('请输入企业代码').fill(tenant.tenantCode);
    await page.getByPlaceholder('请输入用户名').fill(tenant.username);
    await page.getByPlaceholder('请输入密码').fill(tenant.password);
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
    await expect(page.getByText('劳资管理', { exact: true })).toHaveCount(0);
    await expect(page.getByText('财务管理', { exact: true })).toHaveCount(0);
    await expect(page.getByText('合同管理', { exact: true }).first()).toBeVisible();

    await page.goto('/labor/personnel');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/finance/dept-entry');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/wms/materials');
    await expect(page).toHaveURL(/\/wms\/materials/);
    await expect(page.getByRole('heading', { name: '物资总览' })).toBeVisible();

    const userToken = await page.evaluate(() => window.localStorage.getItem('zlt_token'));
    expect(userToken).toBeTruthy();
    const laborResponse = await page.request.get('/api/labor/personnel', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(laborResponse.status()).toBe(403);
    const laborBody = await readJson(laborResponse);
    expect(laborBody?.error || laborBody?.code).toBe('MODULE_NOT_ENABLED');
    const financeResponse = await page.request.get('/api/finance/expenses', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(financeResponse.status()).toBe(403);
    const financeBody = await readJson(financeResponse);
    expect(financeBody?.error || financeBody?.code).toBe('MODULE_NOT_ENABLED');
    const wmsResponse = await page.request.get('/api/wms/inventory', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(wmsResponse.status()).toBe(200);

    await configureTenantPortal(page, developerToken, tenant.tenantId, stamp);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/login');
    await expect(page.getByText(`独立门户验收登录${stamp}`)).toBeVisible();
    await expect(page.getByText(`独立门户验收企业${stamp} · 独立登录入口`)).toBeVisible();
    await expect(page.getByPlaceholder('请输入企业代码')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /开发者登录/ })).toHaveCount(0);
    await page.getByPlaceholder('请输入用户名').fill(tenant.username);
    await page.getByPlaceholder('请输入密码').fill(tenant.password);
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
    await expect(page.getByText('劳资管理', { exact: true })).toHaveCount(0);

    await page.screenshot({
      path: '../docs/smoke-evidence/模块开通独立登录验收.png',
      fullPage: true,
    });
  });
});
