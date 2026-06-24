import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ExcelJS = require(path.resolve(process.cwd(), '../backend/node_modules/exceljs'));

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
  ['生产就绪', '/dev/readiness'],
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

async function expectToast(page: any, text: string | RegExp) {
  await expect(page.locator('[role="status"]').filter({ hasText: text }).first()).toBeVisible();
}

async function workbookSheetNames(response: any): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.body());
  return workbook.worksheets.map((sheet: any) => sheet.name);
}

const formatSmokeMoney = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDeveloperMoney = (value: number) => (value >= 10000 ? `¥${(value / 10000).toFixed(1)}万` : `¥${value.toFixed(0)}`);

const formatDeveloperBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const paginatedTotal = (body: any) => Number(body?.pagination?.total ?? body?.meta?.total ?? body?.data?.total ?? body?.data?.recordCount ?? 0);

function generateValidIdCard(stamp: number, birthDate = '19900301') {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  const seq = String(stamp).slice(-3).padStart(3, '0');
  const base = `110101${birthDate}${seq}`;
  const sum = base.split('').reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
  return `${base}${checks[sum % 11]}`;
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

async function loginSmokeTenant(page: any, tenant: { tenantCode: string; username: string; password: string }) {
  const response = await page.request.post('/api/auth/user/login', {
    data: {
      tenantCode: tenant.tenantCode,
      username: tenant.username,
      password: tenant.password,
    },
  });
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  expect(body?.data?.token).toBeTruthy();
  return body.data.token as string;
}

async function ensureSmokeDepartment(page: any, tenantToken: string, stamp: number, suffix: string) {
  const listResponse = await page.request.get('/api/departments?page=1&pageSize=10', {
    headers: { Authorization: `Bearer ${tenantToken}` },
  });
  expect(listResponse.status()).toBe(200);
  const listBody = await readJson(listResponse);
  const existing = (listBody?.data || []).find((item: any) => item?.id);
  if (existing) return existing.id as string;

  const createResponse = await page.request.post('/api/departments', {
    headers: { Authorization: `Bearer ${tenantToken}` },
    data: {
      name: `小程序分流验收项目部${suffix}`,
      code: `mp-${suffix}-${String(stamp).slice(-6)}`,
      description: '小程序手机号分流验收自动创建',
    },
  });
  expect(createResponse.status()).toBe(201);
  const createBody = await readJson(createResponse);
  expect(createBody?.data?.id).toBeTruthy();
  return createBody.data.id as string;
}

async function createSmokePersonnel(page: any, tenantToken: string, departmentId: string, data: { name: string; phone: string; stamp: number }) {
  const response = await page.request.post('/api/labor/personnel', {
    headers: { Authorization: `Bearer ${tenantToken}` },
    data: {
      name: data.name,
      phone: data.phone,
      idCardNo: generateValidIdCard(data.stamp),
      type: 'WORKER',
      departmentId,
      salaryMode: 'DAILY',
      dailySalary: 320,
      workerDailySalary: 320,
      remark: '小程序手机号分流验收人员',
    },
  });
  expect(response.status()).toBe(201);
  const body = await readJson(response);
  expect(body?.data?.id).toBeTruthy();
  return body.data;
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

async function configureTenantPortal(page: any, developerToken: string, tenantId: string, stamp: number, domain = '127.0.0.1') {
  const response = await page.request.put(`/api/developer/tenants/${tenantId}/portal`, {
    headers: { Authorization: `Bearer ${developerToken}` },
    data: {
      domain,
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
    const enterpriseToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(enterpriseToken).toBeTruthy();
    const meResponse = await page.request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(meResponse.status()).toBe(200);
    const meBody = await readJson(meResponse);
    const enterpriseTenantId = meBody?.data?.user?.tenantId || meBody?.data?.tenantId;
    expect(enterpriseTenantId).toBeTruthy();

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

        await page.getByRole('button', { name: '新增进度款' }).click();
        await page.getByPlaceholder('如：1').fill('1');
        await page.getByPlaceholder('请输入收款金额').fill('2100');
        await page.getByPlaceholder('如：30').fill('17');
        await page.locator('input[type="date"]').fill('2026-06-22');
        await page.getByPlaceholder('请输入描述（选填）').fill('承包合同收款真实浏览器验收');
        await page.getByRole('button', { name: '确认创建' }).click();
        await expect(page.getByText('进度款记录创建成功')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('cell', { name: '¥2,100.00' })).toBeVisible();
        await expect(page.getByText('承包合同收款真实浏览器验收')).toBeVisible();

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
	        await expect(page.getByText('小程序打卡规则已保存').first()).toBeVisible();
	        await page.locator('select').filter({ hasText: '本地测试 / Stub' }).selectOption('stub');
	        await page.getByRole('button', { name: '保存打卡规则' }).click();
	        await expect(page.getByText('小程序打卡规则已保存').first()).toBeVisible();

	        const postCheckIn = async (checkDate: string, county: string) => {
	          const response = await page.request.post('/api/mobile/check-in', {
	            multipart: {
	              appId: 'wx_dev_default_checkin',
	              // Mirrors the default mini-program "selected tenant" path after a company is chosen.
	              tenantId: enterpriseTenantId,
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
	          const body = await readJson(response);
	          expect(response.status(), JSON.stringify(body)).toBe(201);
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

  test('public register creates tenant persists login and supports tenant-code login', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const companyName = `SMOKE注册企业${stamp}`;
    const contactName = `注册联系人${String(stamp).slice(-4)}`;
    const phone = `139${String(stamp).slice(-8)}`;
    const password = 'Admin@2024';
    let tenantId = '';
    let tenantCode = '';

    try {
      await page.goto('/register');
      await expect(page.getByRole('heading', { name: '创建企业账号' })).toBeVisible();
      await page.getByPlaceholder('请输入企业全称').fill(companyName);
      await page.getByPlaceholder('请输入您的姓名').fill(contactName);
      await page.getByPlaceholder('请输入手机号（同时作为登录用户名）').fill(phone);
      await page.getByPlaceholder('请设置登录密码（至少6位）').fill(password);
      await page.getByPlaceholder('请再次输入密码').fill(password);
      await page.getByRole('button', { name: '立即注册' }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: '数据看板' })).toBeVisible();
      await expect(page.getByText(companyName).first()).toBeVisible();

      const registeredToken = await page.evaluate(() => localStorage.getItem('zlt_token'));
      const registeredUser = await page.evaluate(() => JSON.parse(localStorage.getItem('zlt_user') || '{}'));
      expect(registeredToken).toBeTruthy();
      expect(registeredUser.tenantCode).toBeTruthy();
      expect(registeredUser.tenantName).toBe(companyName);
      expect(registeredUser.tenantId).toBeTruthy();
      expect(registeredUser.enabledModules).toEqual(expect.arrayContaining(['wms', 'labor', 'finance']));
      tenantCode = registeredUser.tenantCode;
      tenantId = registeredUser.tenantId;

      const meResponse = await page.request.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${registeredToken}` },
      });
      expect(meResponse.status()).toBe(200);
      const meBody = await readJson(meResponse);
      expect(meBody?.data?.tenant?.code).toBe(tenantCode);
      expect(meBody?.data?.tenantId).toBe(tenantId);

      await page.reload();
      await expect(page.getByRole('heading', { name: '数据看板' })).toBeVisible();
      await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
      await expect(page.getByText('劳资管理', { exact: true })).toBeVisible();
      await expect(page.getByText('财务管理', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: '退出登录' }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.getByPlaceholder('请输入企业代码').fill(tenantCode);
      await page.getByPlaceholder('请输入用户名').fill(phone);
      await page.getByPlaceholder('请输入密码').fill(password);
      await page.getByRole('button', { name: '登 录' }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: '数据看板' })).toBeVisible();

      await page.screenshot({
        path: '../docs/smoke-evidence/公开注册企业登录闭环.png',
        fullPage: true,
      });
    } finally {
      if (tenantId) {
        const developerToken = await getDeveloperToken(page);
        await page.request.delete(`/api/developer/tenants/${tenantId}`, {
          headers: { Authorization: `Bearer ${developerToken}` },
        });
        await page.request.delete(`/api/developer/tenants/${tenantId}/permanent`, {
          headers: { Authorization: `Bearer ${developerToken}` },
        });
      }
    }
  });

  test('enterprise user can verify main dashboard real summary data', async ({ page }) => {
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      contractsResponse,
      departmentsResponse,
      personnelResponse,
      salarySummaryResponse,
      inboundResponse,
      outboundResponse,
      inventoryResponse,
      attendanceResponse,
      anomalyResponse,
    ] = await Promise.all([
      page.request.get('/api/contracts?page=1&pageSize=1', { headers: authHeaders }),
      page.request.get('/api/departments?page=1&pageSize=1', { headers: authHeaders }),
      page.request.get('/api/labor/personnel?page=1&limit=1', { headers: authHeaders }),
      page.request.get(`/api/labor/salary/summary?month=${month}`, { headers: authHeaders }),
      page.request.get('/api/wms/inbound?page=1&pageSize=1', { headers: authHeaders }),
      page.request.get('/api/wms/outbound?page=1&pageSize=1', { headers: authHeaders }),
      page.request.get('/api/wms/inventory?page=1&pageSize=1', { headers: authHeaders }),
      page.request.get(`/api/labor/attendance/monthly?month=${month}`, { headers: authHeaders }),
      page.request.get('/api/labor/anomalies/stats', { headers: authHeaders }),
    ]);
    for (const response of [contractsResponse, departmentsResponse, personnelResponse, salarySummaryResponse, inboundResponse, outboundResponse, inventoryResponse, attendanceResponse, anomalyResponse]) {
      expect(response.status()).toBe(200);
    }

    const contractsBody = await readJson(contractsResponse);
    const departmentsBody = await readJson(departmentsResponse);
    const personnelBody = await readJson(personnelResponse);
    const salaryBody = await readJson(salarySummaryResponse);
    const inboundBody = await readJson(inboundResponse);
    const outboundBody = await readJson(outboundResponse);
    const inventoryBody = await readJson(inventoryResponse);
    const attendanceBody = await readJson(attendanceResponse);
    const anomalyBody = await readJson(anomalyResponse);
    const attendanceTotal = (attendanceBody?.data || []).reduce((sum: number, row: any) => sum + Number(row.attendanceDays || 0), 0);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '数据看板' })).toBeVisible();
    await expect(page.getByTestId('dashboard-contract-count')).toContainText(String(paginatedTotal(contractsBody)));
    await expect(page.getByTestId('dashboard-department-count')).toContainText(String(paginatedTotal(departmentsBody)));
    await expect(page.getByTestId('dashboard-personnel-count')).toContainText(String(paginatedTotal(personnelBody)));
    await expect(page.getByTestId('dashboard-monthly-payment')).toContainText(formatSmokeMoney(Number(salaryBody?.data?.totalPaid || 0)));
    await expect(page.getByTestId('dashboard-total-inbound')).toContainText(String(paginatedTotal(inboundBody)));
    await expect(page.getByTestId('dashboard-total-outbound')).toContainText(String(paginatedTotal(outboundBody)));
    await expect(page.getByTestId('dashboard-current-stock')).toContainText(String(paginatedTotal(inventoryBody)));
    await expect(page.getByTestId('dashboard-active-personnel')).toContainText(String(paginatedTotal(personnelBody)));
    await expect(page.getByTestId('dashboard-monthly-attendance')).toContainText(String(attendanceTotal));
    await expect(page.getByTestId('dashboard-monthly-salary')).toContainText(formatSmokeMoney(Number(salaryBody?.data?.totalPayable || 0)));
    await expect(page.getByTestId('dashboard-anomaly-count')).toContainText(String(Number(anomalyBody?.data?.summary?.unresolvedCount || 0)));

    await page.screenshot({
      path: '../docs/smoke-evidence/企业首页数据看板真实汇总.png',
      fullPage: true,
    });
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

  test('mini-program check-in does not silently route duplicated phone and tenant app routes directly', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const defaultAppId = `wx_smoke_default_conflict_${stamp}`;
    const tenantAppId = `wx_smoke_tenant_direct_${stamp}`;
    const sharedPhone = `137${String(stamp).slice(-8)}`;
    const checkDate = '2026-06-24';
    const tenantAppCheckDate = '2026-06-25';
    const preboundCheckDate = '2026-06-26';
    const disabledPreboundCheckDate = '2026-06-27';
    const reenabledPreboundCheckDate = '2026-06-28';
    const facePath = path.resolve(process.cwd(), 'tests/fixtures/checkin-face.svg');
    const faceBuffer = fs.readFileSync(facePath);

    const developerToken = await getDeveloperToken(page);
    const devHeaders = { Authorization: `Bearer ${developerToken}` };
    const defaultMiniProgramResponse = await page.request.put('/api/developer/mini-program/default', {
      headers: devHeaders,
      data: {
        name: '开发者默认打卡小程序',
        appId: defaultAppId,
        appSecret: 'smoke-secret',
        isEnabled: true,
        remark: '手机号多企业冲突验收',
      },
    });
    expect(defaultMiniProgramResponse.status()).toBe(200);

    const tenantA = await createSmokeTenant(page, stamp + 11);
    const tenantB = await createSmokeTenant(page, stamp + 22);
    const tokenA = await loginSmokeTenant(page, tenantA);
    const tokenB = await loginSmokeTenant(page, tenantB);
    const headersA = { Authorization: `Bearer ${tokenA}` };
    const headersB = { Authorization: `Bearer ${tokenB}` };
    const departmentA = await ensureSmokeDepartment(page, tokenA, stamp, 'a');
    const departmentB = await ensureSmokeDepartment(page, tokenB, stamp, 'b');
    const personA = await createSmokePersonnel(page, tokenA, departmentA, {
      name: `默认小程序冲突A-${stamp}`,
      phone: sharedPhone,
      stamp: stamp + 101,
    });
    const personB = await createSmokePersonnel(page, tokenB, departmentB, {
      name: `默认小程序冲突B-${stamp}`,
      phone: sharedPhone,
      stamp: stamp + 202,
    });

    const tenantMiniProgramResponse = await page.request.put(`/api/developer/tenants/${tenantA.tenantId}/mini-program`, {
      headers: devHeaders,
      data: {
        name: `${tenantA.tenantName}自有打卡小程序`,
        appId: tenantAppId,
        appSecret: 'tenant-smoke-secret',
        isEnabled: true,
        remark: '企业自有 appId 直接分流验收',
      },
    });
    expect(tenantMiniProgramResponse.status()).toBe(200);

    const conflictResponse = await page.request.post('/api/mobile/check-in', {
      data: {
        appId: defaultAppId,
        phone: sharedPhone,
        checkDate,
        latitude: 22.5431,
        longitude: 114.0579,
        province: '广东省',
        city: '深圳市',
        county: '南山区',
        address: '广东省深圳市南山区默认小程序冲突打卡点',
      },
    });
    expect(conflictResponse.status()).toBe(409);
    const conflictBody = await readJson(conflictResponse);
    expect(conflictBody?.error).toBe('MULTIPLE_TENANTS');
    expect(conflictBody?.message).toContain('请选择企业');
    const candidateTenantIds = (conflictBody?.data?.candidates || []).map((candidate: any) => candidate.tenantId);
    expect(candidateTenantIds).toContain(tenantA.tenantId);
    expect(candidateTenantIds).toContain(tenantB.tenantId);

    const listCheckIns = async (headers: Record<string, string>, personnelId: string, date = checkDate) => {
      const response = await page.request.get(`/api/labor/attendance/mobile/check-ins?personnelId=${personnelId}&date=${date}`, { headers });
      expect(response.status()).toBe(200);
      return readJson(response);
    };
    let tenantACheckIns = await listCheckIns(headersA, personA.id);
    let tenantBCheckIns = await listCheckIns(headersB, personB.id);
    expect(Number(tenantACheckIns?.data?.total || 0)).toBe(0);
    expect(Number(tenantBCheckIns?.data?.total || 0)).toBe(0);

    const invalidSelectedTenantResponse = await page.request.post('/api/mobile/check-in', {
      data: {
        appId: `wx_missing_${stamp}`,
        tenantId: tenantA.tenantId,
        phone: sharedPhone,
        checkDate,
        latitude: 22.5431,
        longitude: 114.0579,
        county: '南山区',
      },
    });
    expect(invalidSelectedTenantResponse.status()).toBe(404);
    const invalidSelectedTenantBody = await readJson(invalidSelectedTenantResponse);
    expect(invalidSelectedTenantBody?.error).toBe('MINI_PROGRAM_NOT_FOUND');

    const selectedTenantCheckInResponse = await page.request.post('/api/mobile/check-in', {
      multipart: {
        appId: defaultAppId,
        tenantId: tenantB.tenantId,
        phone: sharedPhone,
        checkDate,
        latitude: '22.5431',
        longitude: '114.0579',
        province: '广东省',
        city: '深圳市',
        county: '南山区',
        address: '广东省深圳市南山区默认小程序选择企业打卡点',
        photo: { name: 'checkin-face.svg', mimeType: 'image/svg+xml', buffer: faceBuffer },
      },
    });
    expect(selectedTenantCheckInResponse.status()).toBe(201);
    const selectedTenantCheckInBody = await readJson(selectedTenantCheckInResponse);
    expect(selectedTenantCheckInBody?.data?.record?.tenantId).toBe(tenantB.tenantId);
    expect(selectedTenantCheckInBody?.data?.record?.personnelId).toBe(personB.id);
    expect(selectedTenantCheckInBody?.data?.record?.appId).toBe(defaultAppId);
    expect(selectedTenantCheckInBody?.data?.record?.photoUrl).toContain('/uploads/');

    tenantACheckIns = await listCheckIns(headersA, personA.id);
    tenantBCheckIns = await listCheckIns(headersB, personB.id);
    expect(Number(tenantACheckIns?.data?.total || 0)).toBe(0);
    expect(Number(tenantBCheckIns?.data?.total || 0)).toBe(1);
    expect((tenantBCheckIns?.data?.records || [])[0]?.appId).toBe(defaultAppId);

    const tenantAppCheckInResponse = await page.request.post('/api/mobile/check-in', {
      multipart: {
        appId: tenantAppId,
        phone: sharedPhone,
        checkDate: tenantAppCheckDate,
        latitude: '22.5431',
        longitude: '114.0579',
        province: '广东省',
        city: '深圳市',
        county: '南山区',
        address: '广东省深圳市南山区企业自有小程序打卡点',
        photo: { name: 'checkin-face.svg', mimeType: 'image/svg+xml', buffer: faceBuffer },
      },
    });
    expect(tenantAppCheckInResponse.status()).toBe(201);
    const tenantAppCheckInBody = await readJson(tenantAppCheckInResponse);
    expect(tenantAppCheckInBody?.data?.record?.tenantId).toBe(tenantA.tenantId);
    expect(tenantAppCheckInBody?.data?.record?.personnelId).toBe(personA.id);
    expect(tenantAppCheckInBody?.data?.record?.appId).toBe(tenantAppId);
    expect(tenantAppCheckInBody?.data?.record?.photoUrl).toContain('/uploads/');

    tenantACheckIns = await listCheckIns(headersA, personA.id, tenantAppCheckDate);
    tenantBCheckIns = await listCheckIns(headersB, personB.id, tenantAppCheckDate);
    expect(Number(tenantACheckIns?.data?.total || 0)).toBe(1);
    expect((tenantACheckIns?.data?.records || [])[0]?.appId).toBe(tenantAppId);
    expect(Number(tenantBCheckIns?.data?.total || 0)).toBe(0);

    await loginDeveloper(page);
    await page.goto('/dev/integrations');
    await expect(page.getByTestId('default-mini-program-config')).toContainText('开发者默认打卡小程序');
    await page.getByTestId('mini-program-binding-phone').fill(sharedPhone);
    await page.getByTestId('mini-program-binding-tenant-id').fill(tenantA.tenantId);
    await page.getByTestId('mini-program-binding-personnel-id').fill(personA.id);
    await page.getByTestId('mini-program-binding-remark').fill('真实 Chrome 预绑定验收');
    await page.getByTestId('mini-program-binding-save').click();
    await expect(page.getByTestId('default-mini-program-phone-bindings')).toContainText(sharedPhone);
    await expect(page.getByTestId('default-mini-program-phone-bindings')).toContainText(tenantA.tenantName);

    const preboundCheckInResponse = await page.request.post('/api/mobile/check-in', {
      multipart: {
        appId: defaultAppId,
        phone: sharedPhone,
        checkDate: preboundCheckDate,
        latitude: '22.5431',
        longitude: '114.0579',
        province: '广东省',
        city: '深圳市',
        county: '南山区',
        address: '广东省深圳市南山区默认小程序预绑定打卡点',
        photo: { name: 'checkin-face.svg', mimeType: 'image/svg+xml', buffer: faceBuffer },
      },
    });
    expect(preboundCheckInResponse.status()).toBe(201);
    const preboundCheckInBody = await readJson(preboundCheckInResponse);
    expect(preboundCheckInBody?.data?.record?.tenantId).toBe(tenantA.tenantId);
    expect(preboundCheckInBody?.data?.record?.personnelId).toBe(personA.id);
    expect(preboundCheckInBody?.data?.record?.appId).toBe(defaultAppId);

    tenantACheckIns = await listCheckIns(headersA, personA.id, preboundCheckDate);
    tenantBCheckIns = await listCheckIns(headersB, personB.id, preboundCheckDate);
    expect(Number(tenantACheckIns?.data?.total || 0)).toBe(1);
    expect((tenantACheckIns?.data?.records || [])[0]?.appId).toBe(defaultAppId);
    expect(Number(tenantBCheckIns?.data?.total || 0)).toBe(0);

    const bindingRow = page.getByTestId('mini-program-binding-row').filter({ hasText: sharedPhone });
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(sharedPhone);
      expect(dialog.message()).toContain('不再自动分流');
      await dialog.accept();
    });
    await bindingRow.getByRole('button', { name: '停用' }).click();
    await expect(bindingRow.getByRole('button', { name: '启用' })).toBeVisible();

    const disabledPreboundResponse = await page.request.post('/api/mobile/check-in', {
      data: {
        appId: defaultAppId,
        phone: sharedPhone,
        checkDate: disabledPreboundCheckDate,
        latitude: 22.5431,
        longitude: 114.0579,
        province: '广东省',
        city: '深圳市',
        county: '南山区',
        address: '广东省深圳市南山区默认小程序停用预绑定打卡点',
      },
    });
    expect(disabledPreboundResponse.status()).toBe(409);
    const disabledPreboundBody = await readJson(disabledPreboundResponse);
    expect(disabledPreboundBody?.error).toBe('MULTIPLE_TENANTS');

    tenantACheckIns = await listCheckIns(headersA, personA.id, disabledPreboundCheckDate);
    tenantBCheckIns = await listCheckIns(headersB, personB.id, disabledPreboundCheckDate);
    expect(Number(tenantACheckIns?.data?.total || 0)).toBe(0);
    expect(Number(tenantBCheckIns?.data?.total || 0)).toBe(0);

    await bindingRow.getByRole('button', { name: '启用' }).click();
    await expect(bindingRow.getByRole('button', { name: '停用' })).toBeVisible();

    const reenabledPreboundResponse = await page.request.post('/api/mobile/check-in', {
      multipart: {
        appId: defaultAppId,
        phone: sharedPhone,
        checkDate: reenabledPreboundCheckDate,
        latitude: '22.5431',
        longitude: '114.0579',
        province: '广东省',
        city: '深圳市',
        county: '南山区',
        address: '广东省深圳市南山区默认小程序重新启用预绑定打卡点',
        photo: { name: 'checkin-face.svg', mimeType: 'image/svg+xml', buffer: faceBuffer },
      },
    });
    expect(reenabledPreboundResponse.status()).toBe(201);
    const reenabledPreboundBody = await readJson(reenabledPreboundResponse);
    expect(reenabledPreboundBody?.data?.record?.tenantId).toBe(tenantA.tenantId);
    expect(reenabledPreboundBody?.data?.record?.personnelId).toBe(personA.id);
    expect(reenabledPreboundBody?.data?.record?.appId).toBe(defaultAppId);

    tenantACheckIns = await listCheckIns(headersA, personA.id, reenabledPreboundCheckDate);
    tenantBCheckIns = await listCheckIns(headersB, personB.id, reenabledPreboundCheckDate);
    expect(Number(tenantACheckIns?.data?.total || 0)).toBe(1);
    expect((tenantACheckIns?.data?.records || [])[0]?.appId).toBe(defaultAppId);
    expect(Number(tenantBCheckIns?.data?.total || 0)).toBe(0);
    await page.screenshot({
      path: '../docs/smoke-evidence/小程序手机号多企业分流.png',
      fullPage: true,
    });
  });

  test('developer can verify dashboard real summary and quick actions', async ({ page }) => {
    await loginDeveloper(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };

    const [statsResponse, usageResponse, revenueResponse, dailyResponse] = await Promise.all([
      page.request.get('/api/developer/stats', { headers: authHeaders }),
      page.request.get('/api/developer/stats/usage?sortBy=apiUsage&limit=10', { headers: authHeaders }),
      page.request.get('/api/developer/stats/revenue?months=12', { headers: authHeaders }),
      page.request.get('/api/developer/stats/daily?days=30', { headers: authHeaders }),
    ]);
    for (const response of [statsResponse, usageResponse, revenueResponse, dailyResponse]) {
      expect(response.status()).toBe(200);
    }

    const statsBody = await readJson(statsResponse);
    const usageBody = await readJson(usageResponse);
    const revenueBody = await readJson(revenueResponse);
    const dailyBody = await readJson(dailyResponse);
    const stats = statsBody.data;
    const usageRows = usageBody.data || [];
    const revenueRows = revenueBody.data || [];
    const dailyRows = dailyBody.data || [];

    await page.goto('/dev');
    await expect(page.getByRole('heading', { name: '开发者后台' })).toBeVisible();
    await expect(page.getByTestId('developer-dashboard-tenants')).toContainText(String(stats.tenants.total));
    await expect(page.getByTestId('developer-dashboard-tenants')).toContainText(`本月新增 ${stats.tenants.newThisMonth}`);
    await expect(page.getByTestId('developer-dashboard-users')).toContainText(String(stats.users.total));
    await expect(page.getByTestId('developer-dashboard-users')).toContainText(`本月新增 ${stats.users.newThisMonth}`);
    await expect(page.getByTestId('developer-dashboard-revenue')).toContainText(formatDeveloperMoney(Number(stats.revenue.thisMonth || 0)));
    await expect(page.getByTestId('developer-dashboard-revenue')).toContainText(`累计 ${formatDeveloperMoney(Number(stats.revenue.total || 0))}`);
    await expect(page.getByTestId('developer-dashboard-api-usage')).toContainText(String(stats.apiUsage.total));
    await expect(page.getByTestId('developer-dashboard-api-usage')).toContainText(`本月 ${stats.apiUsage.thisMonth} 次`);
    await expect(page.getByTestId('developer-dashboard-storage')).toContainText(formatDeveloperBytes(Number(stats.attachments.totalSize || 0)));
    await expect(page.getByTestId('developer-dashboard-storage')).toContainText(`本月新增 ${formatDeveloperBytes(Number(stats.attachments.newThisMonth || 0))}`);
    await expect(page.getByTestId('developer-dashboard-online-users')).toContainText(String(stats.onlineUsers));

    if (usageRows.length > 0) {
      const topUsage = usageRows[0];
      await expect(page.getByTestId('developer-dashboard-usage-ranking')).toContainText(topUsage.name);
      await expect(page.getByTestId('developer-dashboard-usage-ranking')).toContainText(topUsage.code);
      await expect(page.getByTestId('developer-dashboard-usage-ranking')).toContainText(String(topUsage.userCount));
      await expect(page.getByTestId('developer-dashboard-usage-ranking')).toContainText(formatDeveloperBytes(Number(topUsage.storage || 0)));
    }
    if (revenueRows.length > 0) {
      const latestRevenue = revenueRows[revenueRows.length - 1];
      await expect(page.getByTestId('developer-dashboard-revenue-trend')).toContainText(latestRevenue.month.slice(5));
    }
    if (dailyRows.length > 0) {
      const sampledDaily = dailyRows.find((_: any, index: number) => index % 3 === 0) || dailyRows[0];
      await expect(page.getByTestId('developer-dashboard-daily-trend')).toContainText(sampledDaily.date.slice(5));
    }

    await page.getByTestId('developer-dashboard-action-tenants').click();
    await expect(page.getByRole('heading', { name: '租户管理' })).toBeVisible();
    await page.goto('/dev');
    await page.getByTestId('developer-dashboard-action-ai-config').click();
    await expect(page.getByRole('heading', { name: 'AI 模型配置' })).toBeVisible();
    await page.goto('/dev');
    await page.getByTestId('developer-dashboard-action-ocr-config').click();
    await expect(page.getByRole('heading', { name: 'OCR 配置' })).toBeVisible();
    await page.goto('/dev');
    await page.getByTestId('developer-dashboard-action-system-config').click();
    await expect(page.getByRole('heading', { name: '系统配置' })).toBeVisible();
    await page.goto('/dev');
    await page.getByTestId('developer-dashboard-action-logs').click();
    await expect(page.getByRole('heading', { name: '操作日志' })).toBeVisible();

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者首页数据看板真实汇总.png',
      fullPage: true,
    });
  });

  test('developer can manage tenant CRUD users passwords and recycle bin', async ({ page }) => {
    test.setTimeout(120_000);
    await loginDeveloper(page);
    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${developerToken}` };

    const stamp = Date.now();
    const tenantName = `开发者企业CRUD-${stamp}`;
    const tenantNameEdited = `${tenantName}-已编辑`;
    const tenantCode = `devcrud${String(stamp).slice(-8)}`;
    const contactName = `联系人${String(stamp).slice(-4)}`;
    const contactPhone = `139${String(stamp).slice(-8)}`;
    const userName = `dev_user_${String(stamp).slice(-8)}`;
    const userRealName = `开发者创建用户${String(stamp).slice(-4)}`;
    const resetPassword = 'Admin@2025';

    await page.goto('/dev/tenants');
    await expect(page.getByText('租户管理')).toBeVisible();

    await page.getByRole('button', { name: '新增租户' }).click();
    await page.getByPlaceholder('请输入企业名称').fill(tenantName);
    await page.getByPlaceholder('请输入企业代码（唯一标识）').fill(tenantCode);
    await page.getByPlaceholder('请输入联系人姓名').fill(contactName);
    await page.getByPlaceholder('请输入联系电话').fill(contactPhone);
    await page.getByPlaceholder('请输入企业地址（选填）').fill('浏览器验收地址');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expectToast(page, '租户创建成功');

    await page.getByPlaceholder('搜索企业名称或企业代码...').fill(tenantCode);
    await page.keyboard.press('Enter');
    const createdRow = page.locator('tr', { hasText: tenantCode });
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(tenantName);

    const createdResponse = await page.request.get(`/api/developer/tenants?search=${encodeURIComponent(tenantCode)}&pageSize=10`, {
      headers: authHeaders,
    });
    expect(createdResponse.status()).toBe(200);
    const createdBody = await readJson(createdResponse);
    const createdTenant = (createdBody?.data || []).find((tenant: any) => tenant.code === tenantCode);
    expect(createdTenant?.id).toBeTruthy();
    expect(createdTenant?.userCount).toBe(0);

    await createdRow.getByTitle('编辑').click();
    await page.getByPlaceholder('请输入企业名称').fill(tenantNameEdited);
    await page.getByPlaceholder('请输入联系人姓名').fill(`${contactName}改`);
    await page.getByRole('button', { name: '保存修改' }).click();
    await expectToast(page, '租户信息已更新');
    await expect(page.locator('tr', { hasText: tenantCode })).toContainText(tenantNameEdited);

    const editedResponse = await page.request.get(`/api/developer/tenants?search=${encodeURIComponent(tenantCode)}&pageSize=10`, {
      headers: authHeaders,
    });
    expect(editedResponse.status()).toBe(200);
    const editedBody = await readJson(editedResponse);
    const editedTenant = (editedBody?.data || []).find((tenant: any) => tenant.id === createdTenant.id);
    expect(editedTenant?.name).toBe(tenantNameEdited);
    expect(editedTenant?.contactName).toBe(`${contactName}改`);

    await page.locator('tr', { hasText: tenantCode }).getByTitle('查看详情').click();
    await expect(page.getByRole('heading', { name: `企业详情 - ${tenantNameEdited}` })).toBeVisible();
    await expect(page.getByText(tenantCode).last()).toBeVisible();
    await page.getByRole('button', { name: '创建用户' }).click();
    await page.getByPlaceholder('请输入用户名').fill(userName);
    await page.getByPlaceholder('请输入真实姓名（选填）').fill(userRealName);
    await page.getByPlaceholder('请输入密码').fill('Admin@2024');
    await page.locator('select').last().selectOption({ label: '管理员' });
    await page.getByRole('button', { name: '确认创建' }).click();
    await expectToast(page, '用户创建成功');
    await expect(page.getByRole('heading', { name: `企业详情 - ${tenantNameEdited}` })).toBeVisible();
    await expect(page.locator('tr', { hasText: userName })).toContainText(userRealName);

    const tenantUsersResponse = await page.request.get(`/api/developer/tenants/${createdTenant.id}/users?pageSize=20`, {
      headers: authHeaders,
    });
    expect(tenantUsersResponse.status()).toBe(200);
    const tenantUsersBody = await readJson(tenantUsersResponse);
    const createdUser = (tenantUsersBody?.data || []).find((user: any) => user.username === userName);
    expect(createdUser?.id).toBeTruthy();
    expect(createdUser?.tenantId).toBe(createdTenant.id);
    expect(createdUser?.name).toBe(userRealName);

    await page.locator('tr', { hasText: userName }).getByTitle('重置密码').click();
    await page.getByPlaceholder('请输入新密码').fill(resetPassword);
    await page.getByRole('button', { name: '确认重置' }).click();
    await expectToast(page, '密码重置成功');

    const loginWithResetPassword = await page.request.post('/api/auth/user/login', {
      data: { tenantCode, username: userName, password: resetPassword },
    });
    expect(loginWithResetPassword.status()).toBe(200);
    const loginWithResetPasswordBody = await readJson(loginWithResetPassword);
    expect(loginWithResetPasswordBody?.data?.user?.tenantId).toBe(createdTenant.id);

    await page.getByRole('button', { name: '关闭' }).last().click();
    await expect(page.getByRole('heading', { name: `企业详情 - ${tenantNameEdited}` })).toHaveCount(0);
    const rowForDelete = page.locator('tr', { hasText: tenantCode });
    await rowForDelete.getByTitle('删除企业').click();
    const deleteConfirmText = page.getByText(`确定要删除企业「${tenantNameEdited}」吗？删除后可在回收站中恢复。`);
    await expect(deleteConfirmText).toBeVisible();
    await page.getByRole('button', { name: '确认' }).last().click();
    await expectToast(page, `已删除企业「${tenantNameEdited}」`);
    await expect(deleteConfirmText).toHaveCount(0);
    await expect(page.locator('tr', { hasText: tenantCode })).toHaveCount(0);

    const recycleResponse = await page.request.get('/api/developer/tenants/recycle?pageSize=100', {
      headers: authHeaders,
    });
    expect(recycleResponse.status()).toBe(200);
    const recycleBody = await readJson(recycleResponse);
    expect((recycleBody?.data || []).some((tenant: any) => tenant.id === createdTenant.id && tenant.code === tenantCode)).toBe(true);

    await page.getByRole('button', { name: /回收站/ }).click();
    await expect(page.getByRole('heading', { name: '回收站' })).toBeVisible();
    const recycleRow = page.locator('tr', { hasText: tenantCode });
    await expect(recycleRow).toBeVisible();
    await recycleRow.getByRole('button', { name: '恢复' }).click();
    await expectToast(page, `已恢复企业「${tenantNameEdited}」`);
    const recycleAfterRestoreResponse = await page.request.get('/api/developer/tenants/recycle?pageSize=100', {
      headers: authHeaders,
    });
    expect(recycleAfterRestoreResponse.status()).toBe(200);
    const recycleAfterRestoreBody = await readJson(recycleAfterRestoreResponse);
    expect((recycleAfterRestoreBody?.data || []).some((tenant: any) => tenant.id === createdTenant.id)).toBe(false);
    await page.getByRole('button', { name: '关闭' }).last().click();

    await page.getByPlaceholder('搜索企业名称或企业代码...').fill(tenantCode);
    await page.keyboard.press('Enter');
    await expect(page.locator('tr', { hasText: tenantCode })).toBeVisible();

    await page.locator('tr', { hasText: tenantCode }).getByTitle('删除企业').click();
    await page.getByRole('button', { name: '确认' }).last().click();
    await expectToast(page, `已删除企业「${tenantNameEdited}」`);
    await page.getByRole('button', { name: /回收站/ }).click();
    const recycleRowForPermanentDelete = page.locator('tr', { hasText: tenantCode });
    await expect(recycleRowForPermanentDelete).toBeVisible();
    await recycleRowForPermanentDelete.getByRole('button', { name: '永久删除' }).click();
    const permanentDeleteConfirmText = page.getByText(`确定要永久删除企业「${tenantNameEdited}」吗？此操作不可恢复！`);
    await expect(permanentDeleteConfirmText).toBeVisible();
    const permanentDeleteResponsePromise = page.waitForResponse(response =>
      response.url().includes(`/api/developer/tenants/${createdTenant.id}/permanent`)
      && response.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: '确认' }).last().click();
    const permanentDeleteResponse = await permanentDeleteResponsePromise;
    const permanentDeleteBody = await readJson(permanentDeleteResponse);
    expect(permanentDeleteResponse.status(), JSON.stringify(permanentDeleteBody)).toBe(200);
    await expectToast(page, /已永久删除|企业已永久删除/);
    await expect(permanentDeleteConfirmText).toHaveCount(0);
    await expect(page.locator('tr', { hasText: tenantCode })).toHaveCount(0);

    const afterPermanentDeleteResponse = await page.request.get(`/api/developer/tenants?search=${encodeURIComponent(tenantCode)}&pageSize=10`, {
      headers: authHeaders,
    });
    expect(afterPermanentDeleteResponse.status()).toBe(200);
    const afterPermanentDeleteBody = await readJson(afterPermanentDeleteResponse);
    expect((afterPermanentDeleteBody?.data || []).some((tenant: any) => tenant.id === createdTenant.id)).toBe(false);

    await page.getByRole('button', { name: '关闭' }).last().click();
    const tenantForClear = await createSmokeTenant(page, stamp + 101);
    const deleteTenantForClearResponse = await page.request.delete(`/api/developer/tenants/${tenantForClear.tenantId}`, {
      headers: authHeaders,
    });
    expect(deleteTenantForClearResponse.status()).toBe(200);
    await page.getByRole('button', { name: /回收站/ }).click();
    await expect(page.locator('tr', { hasText: tenantForClear.tenantCode })).toBeVisible();
    const clearRecycleResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/developer/tenants/recycle/clear')
      && response.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: '清空回收站' }).click();
    const clearRecycleConfirmText = page.getByText('确定要清空回收站吗？所有已删除的企业将被永久删除，此操作不可恢复！');
    await expect(clearRecycleConfirmText).toBeVisible();
    await page.getByRole('button', { name: '确认' }).last().click();
    const clearRecycleResponse = await clearRecycleResponsePromise;
    const clearRecycleBody = await readJson(clearRecycleResponse);
    expect(clearRecycleResponse.status(), JSON.stringify(clearRecycleBody)).toBe(200);
    await expectToast(page, '回收站已清空');
    await expect(page.locator('tr', { hasText: tenantForClear.tenantCode })).toHaveCount(0);

    const afterClearRecycleResponse = await page.request.get(`/api/developer/tenants?search=${encodeURIComponent(tenantForClear.tenantCode)}&pageSize=10`, {
      headers: authHeaders,
    });
    expect(afterClearRecycleResponse.status()).toBe(200);
    const afterClearRecycleBody = await readJson(afterClearRecycleResponse);
    expect((afterClearRecycleBody?.data || []).some((tenant: any) => tenant.id === tenantForClear.tenantId)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者企业CRUD用户回收站.png',
      fullPage: true,
    });
  });

  test('developer can configure tenant modules and independent login through UI', async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const tenant = await createSmokeTenant(page, stamp);
    const portalCompanyName = `UI独立门户企业${stamp}`;
    const portalTitle = `UI独立门户登录${stamp}`;
    const portalLogoPath = path.resolve(process.cwd(), 'public/icon.png');

    await loginDeveloper(page);
    await page.goto('/dev/tenants');
    await expect(page.getByText('企业管理').first()).toBeVisible();
    await page.getByPlaceholder('搜索企业名称或企业代码...').fill(tenant.tenantName);
    await page.keyboard.press('Enter');
    const tenantRow = page.locator('tr', { hasText: tenant.tenantName });
    await expect(tenantRow).toBeVisible();
    await tenantRow.getByTitle('进入企业视角').click();
    await expect(page).toHaveURL(new RegExp(`/dev/tenants/${tenant.tenantId}/view`));
    await expect(page.getByText(`企业代码: ${tenant.tenantCode}`)).toBeVisible();

    const laborToggle = page.getByTestId('tenant-module-toggle-labor');
    const financeToggle = page.getByTestId('tenant-module-toggle-finance');
    const wmsToggle = page.getByTestId('tenant-module-toggle-wms');
    await expect(wmsToggle).toContainText('已启用');
    await expect(laborToggle).toContainText('已启用');
    await expect(financeToggle).toContainText('已启用');
    await laborToggle.click();
    await financeToggle.click();
    await expect(laborToggle).toContainText('未启用');
    await expect(financeToggle).toContainText('未启用');
    await page.getByRole('button', { name: '保存模块设置' }).click();
    await expect(page.getByText('模块开通状态已保存')).toBeVisible();

    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();
    const modulesResponse = await page.request.get(`/api/developer/tenants/${tenant.tenantId}/modules`, {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(modulesResponse.status()).toBe(200);
    const modulesBody = await readJson(modulesResponse);
    const moduleMap = new Map((modulesBody?.data || []).map((item: any) => [item.moduleKey, item.isEnabled]));
    expect(moduleMap.get('wms')).toBe(true);
    expect(moduleMap.get('labor')).toBe(false);
    expect(moduleMap.get('finance')).toBe(false);

    const portal = page.getByTestId('tenant-portal-config');
    await portal.locator('input[type="checkbox"]').check();
    await page.getByTestId('tenant-portal-domain').fill('localhost');
    await page.getByTestId('tenant-portal-company-name').fill(portalCompanyName);
    await page.getByTestId('tenant-portal-login-title').fill(portalTitle);
    await page.getByTestId('tenant-portal-logo-upload').setInputFiles(portalLogoPath);
    await expect(page.getByText('Logo 上传成功，保存配置后生效')).toBeVisible();
    await expect(page.getByTestId('tenant-portal-logo-url')).toHaveValue(/\/uploads\/portal-logo-/);
    await expect(page.getByTestId('tenant-portal-logo-preview').getByRole('img', { name: '独立登录页 Logo 预览' })).toBeVisible();
    const uploadedPortalLogoUrl = await page.getByTestId('tenant-portal-logo-url').inputValue();
    await page.getByTestId('tenant-portal-theme-color').fill('#16A34A');
    await portal.getByRole('button', { name: '保存独立登录配置' }).click();
    await expect(page.getByText('独立登录页配置已保存')).toBeVisible();

    const portalResponse = await page.request.get(`/api/developer/tenants/${tenant.tenantId}/portal`, {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(portalResponse.status()).toBe(200);
    const portalBody = await readJson(portalResponse);
    expect(portalBody?.data?.domain).toBe('localhost');
    expect(portalBody?.data?.companyName).toBe(portalCompanyName);
    expect(portalBody?.data?.loginTitle).toBe(portalTitle);
    expect(portalBody?.data?.logoUrl).toBe(uploadedPortalLogoUrl);
    expect(portalBody?.data?.themeColor).toBe('#16A34A');
    expect(portalBody?.data?.isEnabled).toBe(true);

    await page.getByRole('button', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto('/login');
    await page.getByPlaceholder('请输入企业代码').fill(tenant.tenantCode);
    await page.getByPlaceholder('请输入用户名').fill(tenant.username);
    await page.getByPlaceholder('请输入密码').fill(tenant.password);
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
    await expect(page.getByText('劳资管理', { exact: true })).toHaveCount(0);
    await expect(page.getByText('财务管理', { exact: true })).toHaveCount(0);

    await page.goto('/labor/personnel');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/finance/expenses');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/wms/materials');
    await expect(page).toHaveURL(/\/wms\/materials/);
    await expect(page.getByRole('heading', { name: '物资总览' })).toBeVisible();

    const userToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(userToken).toBeTruthy();
    const laborResponse = await page.request.get('/api/labor/personnel', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(laborResponse.status()).toBe(403);
    const financeResponse = await page.request.get('/api/finance/expenses', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(financeResponse.status()).toBe(403);
    const wmsResponse = await page.request.get('/api/wms/inventory', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(wmsResponse.status()).toBe(200);

    await page.evaluate(() => window.localStorage.clear());
    await page.goto('http://localhost:5173/login');
    await expect(page.getByText(portalTitle)).toBeVisible();
    await expect(page.getByText(`${portalCompanyName} · 独立登录入口`)).toBeVisible();
    const portalLogoSrc = await page.getByRole('img', { name: portalCompanyName }).getAttribute('src');
    expect(portalLogoSrc).toContain(uploadedPortalLogoUrl);
    await expect(page.getByPlaceholder('请输入企业代码')).toHaveCount(0);
    await page.getByPlaceholder('请输入用户名').fill(tenant.username);
    await page.getByPlaceholder('请输入密码').fill(tenant.password);
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('物资管理', { exact: true })).toBeVisible();
    await expect(page.getByText('劳资管理', { exact: true })).toHaveCount(0);

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者UI模块开通独立登录.png',
      fullPage: true,
    });
  });

  test('developer can manage announcement lifecycle', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const initialTitle = `公告生命周期${stamp}`;
    const editedTitle = `公告生命周期已编辑${stamp}`;
    const initialContent = `公告内容${stamp}`;
    const editedContent = `公告内容已编辑${stamp}`;

    await loginDeveloper(page);
    await page.goto('/dev/announcements');
    await expect(page.getByRole('heading', { name: '系统公告' })).toBeVisible();

    await page.getByRole('button', { name: '发布公告' }).click();
    await page.getByTestId('announcement-title').fill(initialTitle);
    await page.getByTestId('announcement-type').selectOption('maintenance');
    await page.getByTestId('announcement-content').fill(initialContent);
    await page.getByRole('button', { name: '确认发布' }).click();
    await expect(page.getByText('公告已发布')).toBeVisible();
    let announcementRow = page.locator('tr', { hasText: initialTitle });
    await expect(announcementRow).toBeVisible();
    await expect(announcementRow).toContainText('维护');
    await expect(announcementRow).toContainText('已发布');

    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();
    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
      data: enterpriseAccount,
    });
    expect(enterpriseLogin.status()).toBe(200);
    const enterpriseLoginBody = await readJson(enterpriseLogin);
    const enterpriseToken = enterpriseLoginBody?.data?.token;
    expect(enterpriseToken).toBeTruthy();
    const forbiddenDeveloperResponse = await page.request.get('/api/developer/announcements', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenDeveloperResponse.status()).toBe(403);
    const forbiddenEnterpriseAnnouncementResponse = await page.request.get('/api/announcements', {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(forbiddenEnterpriseAnnouncementResponse.status()).toBe(403);

    const listAnnouncements = async () => {
      const response = await page.request.get('/api/developer/announcements', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };
    const listEnterpriseAnnouncements = async () => {
      const response = await page.request.get('/api/announcements?limit=10', {
        headers: { Authorization: `Bearer ${enterpriseToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };

    let listBody = await listAnnouncements();
    let announcement = (listBody?.data || []).find((item: any) => item.title === initialTitle);
    expect(announcement?.id).toBeTruthy();
    const announcementId = announcement.id;
    expect(announcement?.isPublished).toBe(true);
    expect(announcement?.publishedAt).toBeTruthy();
    expect(announcement?.type).toBe('maintenance');
    const firstPublishedAt = announcement.publishedAt;

    let enterpriseListBody = await listEnterpriseAnnouncements();
    let enterpriseAnnouncement = (enterpriseListBody?.data || []).find((item: any) => item.id === announcementId);
    expect(enterpriseAnnouncement?.title).toBe(initialTitle);
    expect(enterpriseAnnouncement?.content).toBe(initialContent);

    await page.evaluate(() => localStorage.clear());
    await loginEnterprise(page);
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-announcements')).toContainText(initialTitle);
    await expect(page.getByTestId('dashboard-announcements')).toContainText(initialContent);

    await page.evaluate(() => localStorage.clear());
    await loginDeveloper(page);
    await page.goto('/dev/announcements');
    announcementRow = page.locator('tr', { hasText: initialTitle });
    await expect(announcementRow).toBeVisible();

    const forbiddenCreateResponse = await page.request.post('/api/developer/announcements', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { title: `非法公告${stamp}`, content: '企业用户不能创建开发者公告', type: 'info' },
    });
    expect(forbiddenCreateResponse.status()).toBe(403);
    const forbiddenUpdateResponse = await page.request.put(`/api/developer/announcements/${announcementId}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { title: `非法编辑${stamp}` },
    });
    expect(forbiddenUpdateResponse.status()).toBe(403);
    const forbiddenPublishResponse = await page.request.post(`/api/developer/announcements/${announcementId}/publish`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenPublishResponse.status()).toBe(403);
    const forbiddenDeleteResponse = await page.request.delete(`/api/developer/announcements/${announcementId}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenDeleteResponse.status()).toBe(403);

    await announcementRow.getByTitle('编辑').click();
    await page.getByTestId('announcement-title').fill(editedTitle);
    await page.getByTestId('announcement-type').selectOption('warning');
    await page.getByTestId('announcement-content').fill(editedContent);
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('公告已更新')).toBeVisible();
    announcementRow = page.locator('tr', { hasText: editedTitle });
    await expect(announcementRow).toBeVisible();
    await expect(announcementRow).toContainText('警告');
    await expect(announcementRow).toContainText(editedContent);

    listBody = await listAnnouncements();
    announcement = (listBody?.data || []).find((item: any) => item.id === announcementId);
    expect(announcement?.title).toBe(editedTitle);
    expect(announcement?.content).toBe(editedContent);
    expect(announcement?.type).toBe('warning');
    expect(announcement?.isPublished).toBe(true);
    enterpriseListBody = await listEnterpriseAnnouncements();
    enterpriseAnnouncement = (enterpriseListBody?.data || []).find((item: any) => item.id === announcementId);
    expect(enterpriseAnnouncement?.title).toBe(editedTitle);
    expect(enterpriseAnnouncement?.content).toBe(editedContent);

    await announcementRow.getByTitle('下架').click();
    await expect(page.getByText('公告已下架')).toBeVisible();
    announcementRow = page.locator('tr', { hasText: editedTitle });
    await expect(announcementRow).toContainText('草稿');
    listBody = await listAnnouncements();
    announcement = (listBody?.data || []).find((item: any) => item.id === announcementId);
    expect(announcement?.isPublished).toBe(false);
    expect(announcement?.publishedAt).toBeNull();
    enterpriseListBody = await listEnterpriseAnnouncements();
    enterpriseAnnouncement = (enterpriseListBody?.data || []).find((item: any) => item.id === announcementId);
    expect(enterpriseAnnouncement).toBeUndefined();

    await announcementRow.getByTitle('发布').click();
    await expect(page.getByText('公告已发布')).toBeVisible();
    announcementRow = page.locator('tr', { hasText: editedTitle });
    await expect(announcementRow).toContainText('已发布');
    listBody = await listAnnouncements();
    announcement = (listBody?.data || []).find((item: any) => item.id === announcementId);
    expect(announcement?.isPublished).toBe(true);
    expect(announcement?.publishedAt).toBeTruthy();
    expect(announcement?.publishedAt).not.toBe(firstPublishedAt);
    enterpriseListBody = await listEnterpriseAnnouncements();
    enterpriseAnnouncement = (enterpriseListBody?.data || []).find((item: any) => item.id === announcementId);
    expect(enterpriseAnnouncement?.title).toBe(editedTitle);

    await page.evaluate(() => localStorage.clear());
    await loginEnterprise(page);
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-announcements')).toContainText(editedTitle);
    await expect(page.getByTestId('dashboard-announcements')).toContainText(editedContent);

    await page.evaluate(() => localStorage.clear());
    await loginDeveloper(page);
    await page.goto('/dev/announcements');
    announcementRow = page.locator('tr', { hasText: editedTitle });
    await expect(announcementRow).toBeVisible();

    await announcementRow.getByTitle('删除').click();
    await expect(page.getByText('确定要删除此公告吗？此操作不可撤销。')).toBeVisible();
    await page.getByRole('button', { name: '删除' }).last().click();
    await expect(page.getByText('公告已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: editedTitle })).toHaveCount(0);
    listBody = await listAnnouncements();
    announcement = (listBody?.data || []).find((item: any) => item.id === announcementId);
    expect(announcement).toBeUndefined();
    enterpriseListBody = await listEnterpriseAnnouncements();
    enterpriseAnnouncement = (enterpriseListBody?.data || []).find((item: any) => item.id === announcementId);
    expect(enterpriseAnnouncement).toBeUndefined();

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者系统公告生命周期CRUD.png',
      fullPage: true,
    });
  });

  test('developer can manage system config and api key lifecycle', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const configKey = `smoke_config_${stamp}`;
    const configValue = `value_${stamp}`;
    const editedConfigValue = `value_edited_${stamp}`;
    const configDescription = `系统配置验收${stamp}`;
    const apiKeyName = `验收密钥${stamp}`;
    const smokeTenant = await createSmokeTenant(page, stamp);

    await loginDeveloper(page);
    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();

    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
      data: {
        tenantCode: smokeTenant.tenantCode,
        username: smokeTenant.username,
        password: smokeTenant.password,
      },
    });
    expect(enterpriseLogin.status()).toBe(200);
    const enterpriseLoginBody = await readJson(enterpriseLogin);
    const enterpriseToken = enterpriseLoginBody?.data?.token;
    expect(enterpriseToken).toBeTruthy();

    const getSystemConfigs = async () => {
      const response = await page.request.get('/api/developer/system-config', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };

    await page.goto('/dev/system-config');
    await expect(page.getByRole('heading', { name: '系统配置' })).toBeVisible();
    await page.getByRole('button', { name: '新增配置' }).click();
    await page.getByTestId('system-config-new-key').fill(configKey);
    await page.getByTestId('system-config-new-value').fill(configValue);
    await page.getByTestId('system-config-new-description').fill(configDescription);
    await page.getByRole('button', { name: '添加' }).click();
    await expect(page.getByText('配置已添加')).toBeVisible();
    const configRow = page.getByTestId(`system-config-row-${configKey}`);
    await expect(configRow).toBeVisible();
    await expect(configRow).toContainText(configDescription);

    let systemConfigs = await getSystemConfigs();
    let configRecord = (systemConfigs?.data || []).find((item: any) => item.key === configKey);
    expect(configRecord?.value).toBe(configValue);
    expect(configRecord?.description).toBe(configDescription);

    await page.getByTestId(`system-config-value-${configKey}`).fill(editedConfigValue);
    await configRow.getByTitle('保存').click();
    await expect(page.getByText('配置已保存')).toBeVisible();
    systemConfigs = await getSystemConfigs();
    configRecord = (systemConfigs?.data || []).find((item: any) => item.key === configKey);
    expect(configRecord?.value).toBe(editedConfigValue);

    const forbiddenSystemConfigRead = await page.request.get('/api/developer/system-config', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenSystemConfigRead.status()).toBe(403);
    const forbiddenSystemConfigWrite = await page.request.put('/api/developer/system-config', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { key: `illegal_${stamp}`, value: 'nope' },
    });
    expect(forbiddenSystemConfigWrite.status()).toBe(403);

    await configRow.getByTitle('删除').click();
    await expect(page.getByText(`确定要删除配置项 "${configKey}" 吗？此操作不可撤销。`)).toBeVisible();
    await page.getByRole('button', { name: '删除' }).last().click();
    await expect(page.getByText('配置已删除')).toBeVisible();
    await expect(page.getByTestId(`system-config-row-${configKey}`)).toHaveCount(0);
    systemConfigs = await getSystemConfigs();
    configRecord = (systemConfigs?.data || []).find((item: any) => item.key === configKey);
    expect(configRecord).toBeUndefined();

    const getApiKeys = async () => {
      const response = await page.request.get('/api/developer/api-keys', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };

    await page.goto('/dev/api-keys');
    await expect(page.getByRole('heading', { name: 'API 密钥管理' })).toBeVisible();
    await page.getByRole('button', { name: '生成密钥' }).click();
    await page.getByTestId('api-key-tenant-id').fill(smokeTenant.tenantId);
    await page.getByTestId('api-key-name').fill(apiKeyName);
    await page.getByRole('button', { name: '确认生成' }).click();
    await expect(page.getByText('API 密钥生成成功')).toBeVisible();
    await expect(page.getByRole('heading', { name: '密钥已生成' })).toBeVisible();
    const rawKey = await page.getByTestId('api-key-raw-key').inputValue();
    expect(rawKey).toMatch(/^zlt_/);
    await page.getByRole('button', { name: '我已保存' }).click();

    let apiKeysBody = await getApiKeys();
    let apiKey = (apiKeysBody?.data || []).find((item: any) => item.name === apiKeyName);
    expect(apiKey?.id).toBeTruthy();
    expect(apiKey?.tenantId).toBe(smokeTenant.tenantId);
    expect(apiKey?.keyPrefix).toBe(rawKey.slice(0, 8));
    expect(apiKey?.isActive).toBe(true);
    let apiKeyRow = page.locator('tr', { hasText: apiKeyName });
    await expect(apiKeyRow).toBeVisible();
    await expect(apiKeyRow).toContainText('启用');

    await apiKeyRow.getByTitle('停用').click();
    await expect(page.getByText('密钥已停用')).toBeVisible();
    apiKeysBody = await getApiKeys();
    apiKey = (apiKeysBody?.data || []).find((item: any) => item.id === apiKey.id);
    expect(apiKey?.isActive).toBe(false);
    apiKeyRow = page.locator('tr', { hasText: apiKeyName });
    await expect(apiKeyRow).toContainText('停用');

    await apiKeyRow.getByTitle('启用').click();
    await expect(page.getByText('密钥已启用')).toBeVisible();
    apiKeysBody = await getApiKeys();
    apiKey = (apiKeysBody?.data || []).find((item: any) => item.id === apiKey.id);
    expect(apiKey?.isActive).toBe(true);

    const forbiddenApiKeyRead = await page.request.get('/api/developer/api-keys', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenApiKeyRead.status()).toBe(403);
    const forbiddenApiKeyCreate = await page.request.post('/api/developer/api-keys', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { tenantId: smokeTenant.tenantId, name: `非法密钥${stamp}` },
    });
    expect(forbiddenApiKeyCreate.status()).toBe(403);
    const forbiddenApiKeyUpdate = await page.request.put(`/api/developer/api-keys/${apiKey.id}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { isActive: false },
    });
    expect(forbiddenApiKeyUpdate.status()).toBe(403);
    const forbiddenApiKeyDelete = await page.request.delete(`/api/developer/api-keys/${apiKey.id}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenApiKeyDelete.status()).toBe(403);

    apiKeyRow = page.locator('tr', { hasText: apiKeyName });
    await apiKeyRow.getByTitle('删除').click();
    await expect(page.getByText('确定要删除此 API 密钥吗？使用该密钥的应用将立即无法访问。此操作不可撤销。')).toBeVisible();
    await page.getByRole('button', { name: '删除' }).last().click();
    await expect(page.getByText('密钥已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: apiKeyName })).toHaveCount(0);
    apiKeysBody = await getApiKeys();
    apiKey = (apiKeysBody?.data || []).find((item: any) => item.name === apiKeyName);
    expect(apiKey).toBeUndefined();

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者系统配置API密钥CRUD.png',
      fullPage: true,
    });
  });

  test('developer can manage platform plan lifecycle', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const initialName = `验收套餐${stamp}`;
    const editedName = `验收套餐已编辑${stamp}`;
    const initialDescription = `套餐生命周期${stamp}`;
    const editedDescription = `套餐生命周期已编辑${stamp}`;

    await loginDeveloper(page);
    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();

    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
      data: enterpriseAccount,
    });
    expect(enterpriseLogin.status()).toBe(200);
    const enterpriseLoginBody = await readJson(enterpriseLogin);
    const enterpriseToken = enterpriseLoginBody?.data?.token;
    expect(enterpriseToken).toBeTruthy();

    const listPlans = async () => {
      const response = await page.request.get('/api/developer/plans', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };

    await page.goto('/dev/plans');
    await expect(page.getByRole('heading', { name: '套餐管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增套餐' }).click();
    await page.getByTestId('plan-name').fill(initialName);
    await page.getByTestId('plan-tier').selectOption('MEDIUM');
    await page.getByTestId('plan-type').selectOption('MODULE');
    await page.getByTestId('plan-price').fill('388.5');
    await page.getByTestId('plan-max-users').fill('18');
    await page.getByTestId('plan-extra-user-price').fill('22.5');
    await page.getByTestId('plan-description').fill(initialDescription);
    await page.getByRole('button', { name: '创建套餐' }).click();
    await expect(page.getByText('套餐已创建')).toBeVisible();

    let plansBody = await listPlans();
    let plan = (plansBody?.data || []).find((item: any) => item.name === initialName);
    expect(plan?.id).toBeTruthy();
    expect(plan?.tier).toBe('MEDIUM');
    expect(plan?.type).toBe('MODULE');
    expect(Number(plan?.pricePerMonth)).toBe(388.5);
    expect(plan?.maxUsers).toBe(18);
    expect(Number(plan?.pricePerExtraUser)).toBe(22.5);
    expect(plan?.description).toBe(initialDescription);

    let planRow = page.getByTestId(`plan-row-${plan.id}`);
    await expect(planRow).toBeVisible();
    await expect(planRow).toContainText(initialName);
    await expect(planRow).toContainText('中型');
    await expect(planRow).toContainText('模块化');
    await expect(planRow).toContainText('¥388.5');

    const forbiddenPlanRead = await page.request.get('/api/developer/plans', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenPlanRead.status()).toBe(403);
    const forbiddenPlanCreate = await page.request.post('/api/developer/plans', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { name: `非法套餐${stamp}`, pricePerMonth: 1 },
    });
    expect(forbiddenPlanCreate.status()).toBe(403);
    const forbiddenPlanUpdate = await page.request.put(`/api/developer/plans/${plan.id}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { name: `非法编辑${stamp}` },
    });
    expect(forbiddenPlanUpdate.status()).toBe(403);
    const forbiddenPlanDelete = await page.request.delete(`/api/developer/plans/${plan.id}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenPlanDelete.status()).toBe(403);

    const invalidPlanResponse = await page.request.post('/api/developer/plans', {
      headers: { Authorization: `Bearer ${developerToken}` },
      data: { name: `非法等级套餐${stamp}`, tier: 'INVALID', type: 'FULL', pricePerMonth: 1 },
    });
    expect(invalidPlanResponse.status()).toBe(400);
    const invalidPlanBody = await readJson(invalidPlanResponse);
    expect(invalidPlanBody?.error).toBe('INVALID_TIER');

    const protectedPlanResponse = await page.request.post('/api/developer/plans', {
      headers: { Authorization: `Bearer ${developerToken}` },
      data: {
        name: `受保护套餐${stamp}`,
        tier: 'MEDIUM',
        type: 'FULL',
        pricePerMonth: 1288,
        maxUsers: 20,
        pricePerExtraUser: 80,
        description: '与演示企业订阅组合一致，删除应被拒绝',
      },
    });
    expect(protectedPlanResponse.status()).toBe(201);
    const protectedPlanBody = await readJson(protectedPlanResponse);
    const protectedPlan = protectedPlanBody?.data;
    expect(protectedPlan?.id).toBeTruthy();
    const protectedDeleteResponse = await page.request.delete(`/api/developer/plans/${protectedPlan.id}`, {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(protectedDeleteResponse.status()).toBe(409);
    const protectedDeleteBody = await readJson(protectedDeleteResponse);
    expect(protectedDeleteBody?.error).toBe('PLAN_HAS_SUBSCRIPTIONS');
    const unprotectResponse = await page.request.put(`/api/developer/plans/${protectedPlan.id}`, {
      headers: { Authorization: `Bearer ${developerToken}` },
      data: { tier: 'LARGE', type: 'MODULE' },
    });
    expect(unprotectResponse.status()).toBe(200);
    const cleanupProtectedResponse = await page.request.delete(`/api/developer/plans/${protectedPlan.id}`, {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(cleanupProtectedResponse.status()).toBe(200);

    await planRow.getByTitle('编辑').click();
    await page.getByTestId('plan-name').fill(editedName);
    await page.getByTestId('plan-tier').selectOption('LARGE');
    await page.getByTestId('plan-type').selectOption('FULL');
    await page.getByTestId('plan-price').fill('688');
    await page.getByTestId('plan-max-users').fill('36');
    await page.getByTestId('plan-extra-user-price').fill('0');
    await page.getByTestId('plan-description').fill(editedDescription);
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('套餐已更新')).toBeVisible();

    plansBody = await listPlans();
    plan = (plansBody?.data || []).find((item: any) => item.id === plan.id);
    expect(plan?.name).toBe(editedName);
    expect(plan?.tier).toBe('LARGE');
    expect(plan?.type).toBe('FULL');
    expect(Number(plan?.pricePerMonth)).toBe(688);
    expect(plan?.maxUsers).toBe(36);
    expect(Number(plan?.pricePerExtraUser)).toBe(0);
    expect(plan?.description).toBe(editedDescription);

    planRow = page.getByTestId(`plan-row-${plan.id}`);
    await expect(planRow).toBeVisible();
    await expect(planRow).toContainText(editedName);
    await expect(planRow).toContainText('大型');
    await expect(planRow).toContainText('全功能');

    await planRow.getByTitle('删除').click();
    await expect(page.getByText('确定要删除此套餐吗？删除后不可恢复，且已订阅此套餐的企业将受到影响。')).toBeVisible();
    await page.getByRole('button', { name: '删除' }).last().click();
    await expect(page.getByText('套餐已删除')).toBeVisible();
    await expect(page.getByTestId(`plan-row-${plan.id}`)).toHaveCount(0);
    plansBody = await listPlans();
    plan = (plansBody?.data || []).find((item: any) => item.name === editedName);
    expect(plan).toBeUndefined();

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者套餐生命周期CRUD.png',
      fullPage: true,
    });
  });

  test('developer can manage AI and OCR config lifecycle', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const aiModel = `smoke-ai-${stamp}`;
    const aiModelEdited = `${aiModel}-edited`;
    const aiApiKey = `sk-smoke-${stamp}-abcd`;
    const aiApiKeyEdited = `sk-smoke-edited-${stamp}-wxyz`;
    const ocrSecretId = `ocr-secret-${stamp}`;
    const ocrSecretIdEdited = `ocr-secret-edited-${stamp}`;

    await loginDeveloper(page);
    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();

    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
      data: enterpriseAccount,
    });
    expect(enterpriseLogin.status()).toBe(200);
    const enterpriseLoginBody = await readJson(enterpriseLogin);
    const enterpriseToken = enterpriseLoginBody?.data?.token;
    expect(enterpriseToken).toBeTruthy();

    const listAiConfigs = async () => {
      const response = await page.request.get('/api/developer/ai-config', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };
    const listOcrConfigs = async () => {
      const response = await page.request.get('/api/developer/ocr-config', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };

    await page.goto('/dev/ai-config');
    await expect(page.getByRole('heading', { name: 'AI 模型配置' })).toBeVisible();
    await page.getByTestId('ai-config-new').click();
    await page.getByTestId('ai-provider').selectOption('openai');
    await page.getByTestId('ai-model').fill(aiModel);
    await page.getByTestId('ai-api-key').fill(aiApiKey);
    await page.getByTestId('ai-base-url').fill('http://127.0.0.1:9/smoke-ai');
    await page.getByTestId('ai-save').click();
    await expectToast(page, 'AI 配置保存成功');

    let aiBody = await listAiConfigs();
    let aiConfig = (aiBody?.data || []).find((item: any) => item.model === aiModel);
    expect(aiConfig?.id).toBeTruthy();
    expect(aiConfig?.provider).toBe('openai');
    expect(aiConfig?.baseUrl).toBe('http://127.0.0.1:9/smoke-ai');
    expect(aiConfig?.apiKey).toBe('sk-s****abcd');
    expect(aiConfig?.isEnabled).toBe(false);
    await expect(page.getByTestId('ai-api-key')).toHaveValue('');
    await expect(page.getByTestId(`ai-config-row-${aiConfig.id}`)).toContainText(aiModel);

    const forbiddenAiRead = await page.request.get('/api/developer/ai-config', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenAiRead.status()).toBe(403);
    const forbiddenAiCreate = await page.request.put('/api/developer/ai-config', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { provider: 'openai', model: `illegal-ai-${stamp}`, apiKey: 'sk-illegal' },
    });
    expect(forbiddenAiCreate.status()).toBe(403);
    const forbiddenAiToggle = await page.request.patch(`/api/developer/ai-config/${aiConfig.id}/toggle`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { enabled: true },
    });
    expect(forbiddenAiToggle.status()).toBe(403);
    const forbiddenAiDelete = await page.request.delete(`/api/developer/ai-config/${aiConfig.id}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenAiDelete.status()).toBe(403);

    await page.getByTestId('ai-config-enabled-toggle').click();
    await expectToast(page, '配置已启用');
    aiBody = await listAiConfigs();
    aiConfig = (aiBody?.data || []).find((item: any) => item.id === aiConfig.id);
    expect(aiConfig?.isEnabled).toBe(true);

    await page.getByTestId('ai-model').fill(aiModelEdited);
    await page.getByTestId('ai-api-key').fill(aiApiKeyEdited);
    await page.getByTestId('ai-save').click();
    await expectToast(page, 'AI 配置保存成功');
    aiBody = await listAiConfigs();
    aiConfig = (aiBody?.data || []).find((item: any) => item.id === aiConfig.id);
    expect(aiConfig?.model).toBe(aiModelEdited);
    expect(aiConfig?.apiKey).toBe('sk-s****wxyz');
    expect(aiConfig?.isEnabled).toBe(false);
    await expect(page.getByTestId('ai-api-key')).toHaveValue('');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('ai-delete').click();
    await expectToast(page, '配置已删除');
    aiBody = await listAiConfigs();
    expect((aiBody?.data || []).find((item: any) => item.id === aiConfig.id)).toBeUndefined();

    await page.goto('/dev/ocr-config');
    await expect(page.getByRole('heading', { name: 'OCR 配置' })).toBeVisible();
    await page.getByTestId('ocr-config-new').click();
    await page.getByTestId('ocr-provider').selectOption('tencent');
    await page.getByTestId('ocr-secret-id').fill(ocrSecretId);
    await page.getByTestId('ocr-secret-key').fill(`ocr-secret-key-${stamp}`);
    await page.getByTestId('ocr-save').click();
    await expectToast(page, 'OCR 配置保存成功');

    let ocrBody = await listOcrConfigs();
    let ocrConfig = (ocrBody?.data || []).find((item: any) => item.secretId === ocrSecretId);
    expect(ocrConfig?.id).toBeTruthy();
    expect(ocrConfig?.provider).toBe('tencent');
    expect(ocrConfig?.secretKey).toBe('ocr-****');
    expect(ocrConfig?.isEnabled).toBe(false);
    await expect(page.getByTestId('ocr-secret-id')).toHaveValue('');
    await expect(page.getByTestId('ocr-secret-key')).toHaveValue('');
    await expect(page.getByTestId(`ocr-config-row-${ocrConfig.id}`)).toContainText('腾讯 OCR');

    const forbiddenOcrRead = await page.request.get('/api/developer/ocr-config', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenOcrRead.status()).toBe(403);
    const forbiddenOcrCreate = await page.request.put('/api/developer/ocr-config', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { provider: 'tencent', secretId: `illegal-ocr-${stamp}`, secretKey: 'illegal-key' },
    });
    expect(forbiddenOcrCreate.status()).toBe(403);
    const forbiddenOcrToggle = await page.request.patch(`/api/developer/ocr-config/${ocrConfig.id}/toggle`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { enabled: true },
    });
    expect(forbiddenOcrToggle.status()).toBe(403);
    const forbiddenOcrDelete = await page.request.delete(`/api/developer/ocr-config/${ocrConfig.id}`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenOcrDelete.status()).toBe(403);

    await page.getByTestId('ocr-test').click();
    await expectToast(page, '连通性测试通过');
    ocrBody = await listOcrConfigs();
    ocrConfig = (ocrBody?.data || []).find((item: any) => item.id === ocrConfig.id);
    expect(ocrConfig?.isEnabled).toBe(true);

    await page.reload();
    await page.getByTestId(`ocr-config-row-${ocrConfig.id}`).click();
    await page.getByTestId('ocr-secret-id').fill(ocrSecretIdEdited);
    await page.getByTestId('ocr-secret-key').fill(`ocr-secret-key-edited-${stamp}`);
    await page.getByTestId('ocr-save').click();
    await expectToast(page, 'OCR 配置保存成功');
    ocrBody = await listOcrConfigs();
    ocrConfig = (ocrBody?.data || []).find((item: any) => item.id === ocrConfig.id);
    expect(ocrConfig?.secretId).toBe(ocrSecretIdEdited);
    expect(ocrConfig?.isEnabled).toBe(false);
    await expect(page.getByTestId('ocr-secret-id')).toHaveValue('');
    await expect(page.getByTestId('ocr-secret-key')).toHaveValue('');

    await page.getByTestId('ocr-config-enabled-toggle').click();
    await expectToast(page, '配置已启用');
    ocrBody = await listOcrConfigs();
    ocrConfig = (ocrBody?.data || []).find((item: any) => item.id === ocrConfig.id);
    expect(ocrConfig?.isEnabled).toBe(true);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('ocr-delete').click();
    await expectToast(page, '配置已删除');
    ocrBody = await listOcrConfigs();
    expect((ocrBody?.data || []).find((item: any) => item.id === ocrConfig.id)).toBeUndefined();

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者AIOCR配置生命周期CRUD.png',
      fullPage: true,
    });
  });

  test('developer can manage integrations security monitoring and logs', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const platform = 'dingtalk';
    const webhook = `https://example.invalid/smoke-dingtalk-${stamp}`;
    const editedWebhook = `${webhook}-edited`;
    const appId = `ding-app-${stamp}`;
    const appSecret = `ding-secret-${stamp}`;

    await loginDeveloper(page);
    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();

    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
      data: enterpriseAccount,
    });
    expect(enterpriseLogin.status()).toBe(200);
    const enterpriseLoginBody = await readJson(enterpriseLogin);
    const enterpriseToken = enterpriseLoginBody?.data?.token;
    expect(enterpriseToken).toBeTruthy();

    const listIntegrations = async () => {
      const response = await page.request.get('/api/developer/integrations', {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      expect(response.status()).toBe(200);
      return readJson(response);
    };

    await page.goto('/dev/integrations');
    await expect(page.getByRole('heading', { name: '第三方集成' })).toBeVisible();
    await expect(page.getByTestId(`integration-card-${platform}`)).toBeVisible();
    await page.getByTestId(`integration-webhook-${platform}`).fill(webhook);
    await page.getByTestId(`integration-app-id-${platform}`).fill(appId);
    await page.getByTestId(`integration-app-secret-${platform}`).fill(appSecret);
    await page.getByTestId(`integration-save-${platform}`).click();
    await expectToast(page, '钉钉 配置保存成功');
    await expect(page.getByTestId(`integration-status-${platform}`)).toContainText('未启用');

    let integrationsBody = await listIntegrations();
    let integration = (integrationsBody?.data || []).find((item: any) => item.platform === platform);
    expect(integration?.id).toBeTruthy();
    expect(integration?.config?.botWebhookUrl).toBe(webhook);
    expect(integration?.config?.appId).toBe(appId);
    expect(integration?.config?.appSecret).toBe(appSecret);
    expect(integration?.isEnabled).toBe(false);

    const forbiddenIntegrationRead = await page.request.get('/api/developer/integrations', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenIntegrationRead.status()).toBe(403);
    const forbiddenIntegrationSave = await page.request.put('/api/developer/integrations', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { platform, config: { botWebhookUrl: `https://illegal.invalid/${stamp}` } },
    });
    expect(forbiddenIntegrationSave.status()).toBe(403);
    const forbiddenIntegrationTest = await page.request.post('/api/developer/integrations/test', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { platform },
    });
    expect(forbiddenIntegrationTest.status()).toBe(403);

    await page.getByTestId(`integration-test-${platform}`).click();
    await expectToast(page, '钉钉 连通性测试通过');
    await expect(page.getByTestId(`integration-status-${platform}`)).toContainText('已启用');
    integrationsBody = await listIntegrations();
    integration = (integrationsBody?.data || []).find((item: any) => item.platform === platform);
    expect(integration?.isEnabled).toBe(true);

    await page.getByTestId(`integration-webhook-${platform}`).fill(editedWebhook);
    await page.getByTestId(`integration-save-${platform}`).click();
    await expectToast(page, '钉钉 配置保存成功');
    await expect(page.getByTestId(`integration-status-${platform}`)).toContainText('未启用');
    integrationsBody = await listIntegrations();
    integration = (integrationsBody?.data || []).find((item: any) => item.platform === platform);
    expect(integration?.config?.botWebhookUrl).toBe(editedWebhook);
    expect(integration?.isEnabled).toBe(false);

    await page.goto('/dev/security');
    await expect(page.getByRole('heading', { name: '安全策略' })).toBeVisible();
    await page.getByTestId('security-login-max-attempts').fill('7');
    await page.getByTestId('security-login-lockout-minutes').fill('21');
    await page.getByTestId('security-password-min-length').fill('10');
    await page.getByTestId('security-session-timeout-minutes').fill('90');
    if ((await page.getByTestId('security-ip-whitelist').count()) === 0) {
      await page.getByTestId('security-ip-whitelist-toggle').click();
    }
    await page.getByTestId('security-ip-whitelist').fill('127.0.0.1\n10.0.0.0/24');
    await page.getByTestId('security-save-bottom').click();
    await expectToast(page, '安全设置已保存');

    const securityResponse = await page.request.get('/api/developer/security-settings', {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(securityResponse.status()).toBe(200);
    const securityBody = await readJson(securityResponse);
    expect(Number(securityBody?.data?.login_max_attempts)).toBe(7);
    expect(Number(securityBody?.data?.login_lockout_minutes)).toBe(21);
    expect(Number(securityBody?.data?.password_min_length)).toBe(10);
    expect(Number(securityBody?.data?.session_timeout_minutes)).toBe(90);
    expect(String(securityBody?.data?.ip_whitelist_enabled)).toBe('true');
    expect(securityBody?.data?.ip_whitelist).toContain('10.0.0.0/24');

    const forbiddenSecurityRead = await page.request.get('/api/developer/security-settings', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenSecurityRead.status()).toBe(403);
    const forbiddenSecuritySave = await page.request.put('/api/developer/security-settings', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { login_max_attempts: 99 },
    });
    expect(forbiddenSecuritySave.status()).toBe(403);

    await page.goto('/dev/monitoring');
    await expect(page.getByRole('heading', { name: '系统监控' })).toBeVisible();
    await expect(page.getByTestId('monitoring-card-0')).toContainText('当前在线');
    await page.getByTestId('monitoring-refresh').click();
    await expect(page.getByTestId('monitoring-card-1')).toContainText('今日 API 调用');
    const monitoringResponse = await page.request.get('/api/developer/monitoring', {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(monitoringResponse.status()).toBe(200);
    const monitoringBody = await readJson(monitoringResponse);
    expect(typeof monitoringBody?.data?.onlineUsers).toBe('number');
    expect(typeof monitoringBody?.data?.dailyApiCalls).toBe('number');
    const forbiddenMonitoringRead = await page.request.get('/api/developer/monitoring', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenMonitoringRead.status()).toBe(403);

    const readinessResponse = await page.request.get('/api/developer/readiness', {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(readinessResponse.status()).toBe(200);
    const readinessBody = await readJson(readinessResponse);
    expect(readinessBody?.data?.checks?.length).toBeGreaterThanOrEqual(5);
    expect(readinessBody?.data?.checks?.some((check: any) => check.key === 'face_gateway')).toBe(true);
    expect(JSON.stringify(readinessBody)).not.toContain(process.env.FACE_RECOGNITION_HTTP_API_KEY || 'secret-token-never-present');
    const forbiddenReadinessRead = await page.request.get('/api/developer/readiness', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenReadinessRead.status()).toBe(403);

    await page.goto('/dev/readiness');
    await expect(page.getByRole('heading', { name: '生产就绪自检' })).toBeVisible();
    await expect(page.getByTestId('readiness-overall')).toContainText(/可上线|需关注/);
    await expect(page.getByTestId('readiness-check-face_gateway')).toContainText('人脸识别 HTTP 网关');
    await page.getByTestId('readiness-refresh').click();
    await expectToast(page, '生产就绪自检已刷新');

    const integrationLogsResponse = await page.request.get('/api/logs', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { module: 'integration', action: 'UPDATE', pageSize: 20 },
    });
    expect(integrationLogsResponse.status()).toBe(200);
    const integrationLogs = await readJson(integrationLogsResponse);
    expect((integrationLogs?.data || []).some((item: any) => item.description === `更新${platform}集成配置`)).toBe(true);

    const securityLogsResponse = await page.request.get('/api/logs', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { module: 'security', action: 'UPDATE', pageSize: 20 },
    });
    expect(securityLogsResponse.status()).toBe(200);
    const securityLogs = await readJson(securityLogsResponse);
    expect((securityLogs?.data || []).some((item: any) => item.description === '更新安全策略设置')).toBe(true);

    await page.goto('/dev/logs');
    await expect(page.getByRole('heading', { name: '操作日志' })).toBeVisible();
    await page.getByTestId('logs-module-filter').selectOption('integration');
    await page.getByTestId('logs-action-filter').selectOption('UPDATE');
    await expect(page.locator('tbody tr', { hasText: `更新${platform}集成配置` }).first()).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: '第三方集成' }).first()).toBeVisible();
    await page.getByTestId('logs-module-filter').selectOption('security');
    await expect(page.locator('tbody tr', { hasText: '更新安全策略设置' }).first()).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: '安全策略' }).first()).toBeVisible();
    await page.getByTestId('logs-reset-filters').click();
    await expect(page.getByTestId('logs-module-filter')).toHaveValue('');
    await expect(page.getByTestId('logs-action-filter')).toHaveValue('');

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者集成安全监控日志CRUD.png',
      fullPage: true,
    });
  });

  test('developer can manage payments invoices and storage observability', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const invoiceTitle = `开发者验收发票抬头-${stamp}`;
    const taxId = `TAX${stamp}`;
    const attachmentName = `developer-storage-${stamp}.pdf`;

    await loginDeveloper(page);
    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(developerToken).toBeTruthy();

    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
      data: enterpriseAccount,
    });
    expect(enterpriseLogin.status()).toBe(200);
    const enterpriseLoginBody = await readJson(enterpriseLogin);
    const enterpriseToken = enterpriseLoginBody?.data?.token;
    expect(enterpriseToken).toBeTruthy();

    const tenantResponse = await page.request.get('/api/developer/tenants?page=1&pageSize=100', {
      headers: { Authorization: `Bearer ${developerToken}` },
    });
    expect(tenantResponse.status()).toBe(200);
    const tenantBody = await readJson(tenantResponse);
    const demoTenant = (tenantBody?.data || []).find((item: any) => item.code === enterpriseAccount.tenantCode);
    expect(demoTenant?.id).toBeTruthy();

    await page.goto('/dev/payments');
    await expect(page.getByRole('heading', { name: '支付记录' })).toBeVisible();
    await page.getByPlaceholder('搜索企业名称...').fill('演示建筑');
    await page.keyboard.press('Enter');
    await page.getByTestId('developer-payments-status-filter').selectOption('completed');
    await expect(page.locator('tbody tr', { hasText: '演示建筑工程有限公司' }).first()).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: '已完成' }).first()).toBeVisible();

    const paymentsResponse = await page.request.get('/api/developer/payments', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { keyword: '演示建筑', status: 'completed', pageSize: 10 },
    });
    expect(paymentsResponse.status()).toBe(200);
    const paymentsBody = await readJson(paymentsResponse);
    const seedPayment = (paymentsBody?.data || []).find((item: any) => item.transactionId === 'DEMO-PAY-20260623');
    expect(seedPayment?.tenantName).toBe('演示建筑工程有限公司');
    expect(seedPayment?.status).toBe('completed');

    for (const pathName of ['/api/developer/payments', '/api/developer/invoices', '/api/developer/storage/stats', '/api/developer/storage/files']) {
      const forbiddenRead = await page.request.get(pathName, {
        headers: { Authorization: `Bearer ${enterpriseToken}` },
      });
      expect(forbiddenRead.status()).toBe(403);
    }
    const forbiddenInvoiceCreate = await page.request.post('/api/developer/invoices', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      data: { tenantId: demoTenant.id, title: `非法发票-${stamp}`, amount: 1 },
    });
    expect(forbiddenInvoiceCreate.status()).toBe(403);

    await page.goto('/dev/invoices');
    await expect(page.getByRole('heading', { name: '发票管理' })).toBeVisible();
    await page.getByTestId('developer-invoice-new').click();
    await page.getByTestId('developer-invoice-tenant').selectOption(demoTenant.id);
    await page.getByTestId('developer-invoice-title').fill(invoiceTitle);
    await page.getByTestId('developer-invoice-tax-id').fill(taxId);
    await page.getByTestId('developer-invoice-amount').fill('321.45');
    await page.getByTestId('developer-invoice-create').click();
    await expectToast(page, '发票创建成功');

    let invoicesResponse = await page.request.get('/api/developer/invoices', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { pageSize: 20 },
    });
    expect(invoicesResponse.status()).toBe(200);
    let invoicesBody = await readJson(invoicesResponse);
    let invoice = (invoicesBody?.data || []).find((item: any) => item.title === invoiceTitle);
    expect(invoice?.id).toBeTruthy();
    expect(invoice?.tenantId).toBe(demoTenant.id);
    expect(invoice?.tenantName).toBe('演示建筑工程有限公司');
    expect(invoice?.taxId).toBe(taxId);
    expect(invoice?.status).toBe('pending');
    await expect(page.getByTestId(`developer-invoice-row-${invoice.id}`)).toContainText(invoiceTitle);
    await expect(page.getByTestId(`developer-invoice-row-${invoice.id}`)).toContainText('待开具');

    await page.getByTestId(`developer-invoice-issue-${invoice.id}`).click();
    await expectToast(page, '发票已开具');
    invoicesResponse = await page.request.get('/api/developer/invoices', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { pageSize: 20 },
    });
    invoicesBody = await readJson(invoicesResponse);
    invoice = (invoicesBody?.data || []).find((item: any) => item.id === invoice.id);
    expect(invoice?.status).toBe('issued');
    expect(invoice?.issuedAt).toBeTruthy();
    await expect(page.getByTestId(`developer-invoice-row-${invoice.id}`)).toContainText('已开具');

    const forbiddenIssue = await page.request.post(`/api/developer/invoices/${invoice.id}/issue`, {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
    });
    expect(forbiddenIssue.status()).toBe(403);

    const fixtureBuffer = fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/contract-attachment.pdf'));
    const uploadResponse = await page.request.post('/api/labor/attachment/upload', {
      headers: { Authorization: `Bearer ${enterpriseToken}` },
      multipart: {
        entityType: 'developer_storage_smoke',
        entityId: `developer-storage-${stamp}`,
        category: 'storage-smoke',
        files: {
          name: attachmentName,
          mimeType: 'application/pdf',
          buffer: fixtureBuffer,
        },
      },
    });
    expect(uploadResponse.status()).toBe(201);
    const uploadBody = await readJson(uploadResponse);
    const uploadedAttachment = uploadBody?.data?.[0];
    expect(uploadedAttachment?.id).toBeTruthy();
    expect(uploadedAttachment?.fileName).toBe(attachmentName);

    await page.goto('/dev/storage');
    await expect(page.getByRole('heading', { name: '存储管理' })).toBeVisible();
    await expect(page.getByTestId('developer-storage-total-files')).toContainText(/[1-9]/);
    await expect(page.locator('tbody tr', { hasText: '演示建筑工程有限公司' }).first()).toBeVisible();
    await page.getByTestId('developer-storage-tab-files').click();
    await expect(page.locator('tbody tr', { hasText: attachmentName }).first()).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: attachmentName }).first()).toContainText('演示建筑工程有限公司');

    const storageStatsResponse = await page.request.get('/api/developer/storage/stats', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { pageSize: 100 },
    });
    expect(storageStatsResponse.status()).toBe(200);
    const storageStatsBody = await readJson(storageStatsResponse);
    expect(storageStatsBody?.summary?.totalFiles).toBeGreaterThanOrEqual(1);
    const demoStorage = (storageStatsBody?.data || []).find((item: any) => item.id === demoTenant.id);
    expect(demoStorage?.fileCount).toBeGreaterThanOrEqual(1);

    const storageFilesResponse = await page.request.get('/api/developer/storage/files', {
      headers: { Authorization: `Bearer ${developerToken}` },
      params: { pageSize: 50 },
    });
    expect(storageFilesResponse.status()).toBe(200);
    const storageFilesBody = await readJson(storageFilesResponse);
    const storageFile = (storageFilesBody?.data || []).find((item: any) => item.id === uploadedAttachment.id);
    expect(storageFile?.tenantName).toBe('演示建筑工程有限公司');
    expect(storageFile?.fileName).toBe(attachmentName);

    await page.screenshot({
      path: '../docs/smoke-evidence/开发者支付发票存储CRUD.png',
      fullPage: true,
    });
  });

  test('enterprise user can manage subscription plan lifecycle', async ({ page }) => {
    await loginEnterprise(page);
    const enterpriseToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(enterpriseToken).toBeTruthy();

    const authHeaders = { Authorization: `Bearer ${enterpriseToken}` };

    const resetResponse = await page.request.post('/api/subscription/change-plan', {
      headers: authHeaders,
      data: { plan: 'FULL', tier: 'SMALL' },
    });
    expect(resetResponse.status()).toBe(200);

    const currentBeforeResponse = await page.request.get('/api/subscription/current', {
      headers: authHeaders,
    });
    expect(currentBeforeResponse.status()).toBe(200);
    const currentBeforeBody = await readJson(currentBeforeResponse);
    expect(currentBeforeBody?.data?.plan).toBe('FULL');
    expect(currentBeforeBody?.data?.tier).toBe('SMALL');

    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: '订阅计划' })).toBeVisible();
    await expect(page.getByTestId('subscription-current-card')).toContainText('全系统会员');
    await expect(page.getByTestId('subscription-plan-FULL-MEDIUM')).toBeVisible();
    await page.getByTestId('subscription-change-FULL-MEDIUM').click();
    await expect(page.getByRole('heading', { name: '确认变更套餐' })).toBeVisible();
    await page.getByTestId('subscription-confirm-change').click();
    await expectToast(page, '已切换到「全系统会员 · 中型」套餐');

    const currentAfterResponse = await page.request.get('/api/subscription/current', {
      headers: authHeaders,
    });
    expect(currentAfterResponse.status()).toBe(200);
    const currentAfterBody = await readJson(currentAfterResponse);
    expect(currentAfterBody?.data?.plan).toBe('FULL');
    expect(currentAfterBody?.data?.tier).toBe('MEDIUM');
    expect(currentAfterBody?.data?.maxUsers).toBe(20);
    expect(currentAfterBody?.data?.status).toBe('ACTIVE');
    await expect(page.getByTestId('subscription-current-card')).toContainText('中型');
    await expect(page.getByTestId('subscription-current-card')).toContainText('15456 元/年');

    const paymentsResponse = await page.request.get('/api/subscription/payments', {
      headers: authHeaders,
      params: { page: 1, pageSize: 10 },
    });
    expect(paymentsResponse.status()).toBe(200);
    const paymentsBody = await readJson(paymentsResponse);
    expect(Array.isArray(paymentsBody?.data)).toBe(true);
    expect((paymentsBody?.data || []).some((item: any) => item.transactionId === 'DEMO-PAY-20260623')).toBe(true);

    const restoreResponse = await page.request.post('/api/subscription/change-plan', {
      headers: authHeaders,
      data: { plan: 'FULL', tier: 'SMALL' },
    });
    expect(restoreResponse.status()).toBe(200);
    const restoreBody = await readJson(restoreResponse);
    expect(restoreBody?.data?.plan).toBe('FULL');
    expect(restoreBody?.data?.tier).toBe('SMALL');

    await page.reload();
    await expect(page.getByTestId('subscription-current-card')).toContainText('小型');
    await expect(page.getByTestId('subscription-plan-FULL-SMALL')).toContainText('当前套餐');

    await page.screenshot({
      path: '../docs/smoke-evidence/企业订阅计划生命周期CRUD.png',
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

  test('enterprise user can manage wms material catalog CRUD and export', async ({ page }) => {
    test.setTimeout(90_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const materialName = `浏览器物资档案-${stamp}`;
    const editedMaterialName = `${materialName}-已编辑`;
    const materialCode = `MAT-${stamp}`;
    const editedCode = `${materialCode}-E`;
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();

    await page.goto('/wms/materials');
    await page.getByRole('button', { name: '物资档案' }).click();
    await expect(page.getByRole('button', { name: '新增物资' })).toBeVisible();

    await page.getByRole('button', { name: '新增物资' }).click();
    await page.getByPlaceholder('请输入物资编码').fill(materialCode);
    await page.getByPlaceholder('请输入物资名称').fill(materialName);
    await page.getByPlaceholder('请输入规格型号').fill('E2E-10mm');
    await page.getByPlaceholder('请输入单位').fill('吨');
    await page.getByPlaceholder('请输入单价').fill('321.45');
    await page.getByPlaceholder('请输入分类').fill('测试材料');
    await page.getByRole('button', { name: '创建物资' }).click();
    await expect(page.getByText('物资已创建')).toBeVisible();
    await expect(page.locator('tr', { hasText: materialName })).toBeVisible();

    const createdResponse = await page.request.get(`/api/wms/materials?name=${encodeURIComponent(materialName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(createdResponse.status()).toBe(200);
    const createdBody = await readJson(createdResponse);
    const createdMaterial = (createdBody?.data || []).find((item: any) => item.name === materialName);
    expect(createdMaterial?.id).toBeTruthy();
    expect(createdMaterial?.code).toBe(materialCode);
    expect(createdMaterial?.unit).toBe('吨');

    await page.getByPlaceholder('搜索物资档案...').fill(materialName);
    const materialRow = page.locator('tr', { hasText: materialName });
    await expect(materialRow).toBeVisible();
    await materialRow.getByTitle('编辑物资').click();
    await page.getByPlaceholder('请输入物资编码').fill(editedCode);
    await page.getByPlaceholder('请输入物资名称').fill(editedMaterialName);
    await page.getByPlaceholder('请输入单价').fill('654.32');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('物资已更新')).toBeVisible();
    await page.getByPlaceholder('搜索物资档案...').fill(editedMaterialName);
    const editedRow = page.locator('tr', { hasText: editedMaterialName });
    await expect(editedRow).toBeVisible();
    await expect(editedRow).toContainText(editedCode);
    await expect(editedRow).toContainText('¥654.32');

    const editedResponse = await page.request.get(`/api/wms/materials?name=${encodeURIComponent(editedMaterialName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(editedResponse.status()).toBe(200);
    const editedBody = await readJson(editedResponse);
    const editedMaterial = (editedBody?.data || []).find((item: any) => item.name === editedMaterialName);
    expect(editedMaterial?.id).toBe(createdMaterial.id);
    expect(editedMaterial?.code).toBe(editedCode);
    expect(Number(editedMaterial?.unitPrice)).toBe(654.32);

    const exportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出物资档案' }).click();
    expect((await exportPromise).suggestedFilename()).toBe('物资档案.xlsx');
    await expect(page.getByText('物资档案已导出')).toBeVisible();

    await editedRow.getByTitle('删除物资').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('物资已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: editedMaterialName })).toHaveCount(0);

    const afterDeleteResponse = await page.request.get(`/api/wms/materials?name=${encodeURIComponent(editedMaterialName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterDeleteResponse.status()).toBe(200);
    const afterDeleteBody = await readJson(afterDeleteResponse);
    expect((afterDeleteBody?.data || []).some((item: any) => item.id === createdMaterial.id)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/物资档案CRUD导出.png',
      fullPage: true,
    });
  });

  test('enterprise user can import and export wms inbound records with cascade delete preview', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const supplierName = `Excel入库供应商-${Date.now()}`;

    await page.goto('/wms/inbound');
    await expect(page.getByRole('heading', { name: '入库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增入库' }).click();
    await page.getByPlaceholder('输入供应商名称').fill(supplierName);
    await page.locator('select').filter({ hasText: '不选择项目部' }).selectOption({ label: '第一项目部' });
    await page.getByText('Excel 导入').click();
    await page.locator('input[type="date"]').fill('2026-06-23');

    const templateDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载模板' }).click();
    const templateDownload = await templateDownloadPromise;
    expect(templateDownload.suggestedFilename()).toMatch(/^(入库模板|inbound_template)\.xlsx$/);
    const templatePath = await templateDownload.path();
    expect(templatePath).toBeTruthy();

    await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles(templatePath!);
    await expect(page.getByRole('button', { name: '开始导入' })).toBeEnabled();
    await page.getByRole('button', { name: '开始导入' }).click();
    await expectToast(page, 'Excel 导入成功！');

    const importedResponse = await page.request.get('/api/wms/inbound?source=excel&pageSize=5', {
      headers: authHeaders,
    });
    expect(importedResponse.status()).toBe(200);
    const importedBody = await readJson(importedResponse);
    const importedOrder = (importedBody?.data || []).find((order: any) =>
      order.source === 'excel'
      && order.supplierName === supplierName
      && (order.department?.name === '第一项目部' || order.subProject?.department?.name === '第一项目部')
      && (order.items || []).some((item: any) => (item.material?.name || item.materialName) === '举例：水泥42.5')
    );
    expect(importedOrder?.id).toBeTruthy();
    expect(importedOrder?.orderNo).toBeTruthy();
    expect((importedOrder.items || []).some((item: any) => Number(item.quantity || 0) === 10)).toBe(true);

    await page.goto('/wms/inbound');
    await expect(page.locator('tr', { hasText: importedOrder.orderNo })).toBeVisible();
    await expect(page.locator('tr', { hasText: importedOrder.orderNo })).toContainText(supplierName);

    const inboundExportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出入库记录' }).click();
    expect((await inboundExportPromise).suggestedFilename()).toBe('入库记录.xlsx');
    await expectToast(page, '入库记录已导出');

    const rowForDelete = page.locator('tr', { hasText: importedOrder.orderNo });
    await rowForDelete.getByTitle('删除').click();
    await expect(page.getByRole('heading', { name: '确认删除入库单' })).toBeVisible();
    const deleteDialog = page.locator('.fixed').filter({ hasText: '确认删除入库单' }).last();
    await expect(deleteDialog.getByText(importedOrder.orderNo)).toBeVisible();
    await expect(deleteDialog.getByText('库存影响')).toBeVisible();
    await expect(deleteDialog.getByText('举例：水泥42.5')).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expectToast(page, '入库单已删除，可在回收站恢复');
    await expect(page.locator('tr', { hasText: importedOrder.orderNo })).toHaveCount(0);

    const afterDeleteResponse = await page.request.get('/api/wms/inbound?source=excel&pageSize=20', {
      headers: authHeaders,
    });
    expect(afterDeleteResponse.status()).toBe(200);
    const afterDeleteBody = await readJson(afterDeleteResponse);
    expect((afterDeleteBody?.data || []).some((order: any) => order.id === importedOrder.id)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/入库导入导出删除预览.png',
      fullPage: true,
    });
  });

  test('enterprise user can export delivery orders and handle OCR upload failures', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };

    const departmentsResponse = await page.request.get('/api/departments?pageSize=100', { headers: authHeaders });
    expect(departmentsResponse.status()).toBe(200);
    const departmentsBody = await readJson(departmentsResponse);
    const department = (departmentsBody?.data || []).find((item: any) => item.name === '第一项目部') || (departmentsBody?.data || [])[0];
    expect(department?.id).toBeTruthy();

    const subProjectsResponse = await page.request.get(`/api/departments/${department.id}/sub-projects`, { headers: authHeaders });
    expect(subProjectsResponse.status()).toBe(200);
    const subProjectsBody = await readJson(subProjectsResponse);
    let subProject = (subProjectsBody?.data || []).find((item: any) => item.name === '1号楼');
    if (!subProject) {
      const createSubProjectResponse = await page.request.post(`/api/departments/${department.id}/sub-projects`, {
        headers: authHeaders,
        data: { name: '1号楼', code: `DO-${Date.now()}`, description: '送货单导出浏览器验收子项目' },
      });
      expect(createSubProjectResponse.status()).toBe(201);
      const createSubProjectBody = await readJson(createSubProjectResponse);
      subProject = createSubProjectBody?.data;
    }
    expect(subProject?.id).toBeTruthy();

    const stamp = Date.now();
    const materialName = `送货单导出材料-${stamp}`;
    const createDeliveryResponse = await page.request.post('/api/wms/delivery-orders', {
      headers: authHeaders,
      data: {
        departmentId: department.id,
        subProjectId: subProject.id,
        deliveryDate: '2026-06-23',
        remark: '浏览器验收送货单导出',
        items: [
          {
            materialName,
            spec: 'S34',
            unit: '件',
            deliveryQty: 8,
            actualQty: 7,
            unitPrice: 12,
            projectName: subProject.name,
          },
        ],
      },
    });
    expect(createDeliveryResponse.status()).toBe(201);
    const createDeliveryBody = await readJson(createDeliveryResponse);
    const deliveryOrder = createDeliveryBody?.data;
    expect(deliveryOrder?.id).toBeTruthy();
    expect(deliveryOrder?.orderNo).toBeTruthy();

    const listDeliveryResponse = await page.request.get(`/api/wms/delivery-orders?subProjectId=${subProject.id}&pageSize=20`, {
      headers: authHeaders,
    });
    expect(listDeliveryResponse.status()).toBe(200);
    const listDeliveryBody = await readJson(listDeliveryResponse);
    expect((listDeliveryBody?.data || []).some((order: any) =>
      order.id === deliveryOrder.id
      && (order.items || []).some((item: any) => item.materialName === materialName && Number(item.actualQty) === 7)
    )).toBe(true);

    await page.goto('/wms/inbound');
    await expect(page.getByRole('heading', { name: '入库管理' })).toBeVisible();

    const deliveryExportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出送货单' }).click();
    expect((await deliveryExportPromise).suggestedFilename()).toBe('送货单.xlsx');
    await expectToast(page, '送货单已导出');

    const fixturePath = path.join(process.cwd(), 'tmp-ocr-smoke.png');
    fs.writeFileSync(
      fixturePath,
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'),
    );
    await page.getByRole('button', { name: '新增入库' }).click();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'OCR 识别' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);
    await expectToast(page, /识别失败|OCR|配置|请先|失败/);

    await page.screenshot({
      path: '../docs/smoke-evidence/送货单导出OCR上传保护.png',
      fullPage: true,
    });
  });

  test('enterprise user can import and export wms return records with cascade delete preview', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };

    const departmentsResponse = await page.request.get('/api/departments?pageSize=100', { headers: authHeaders });
    expect(departmentsResponse.status()).toBe(200);
    const departmentsBody = await readJson(departmentsResponse);
    const department = (departmentsBody?.data || []).find((item: any) => item.name === '第一项目部') || (departmentsBody?.data || [])[0];
    expect(department?.id).toBeTruthy();

    const subProjectsResponse = await page.request.get(`/api/departments/${department.id}/sub-projects`, { headers: authHeaders });
    expect(subProjectsResponse.status()).toBe(200);
    const subProjectsBody = await readJson(subProjectsResponse);
    let subProject = (subProjectsBody?.data || []).find((item: any) => item.name === '1号楼');
    if (!subProject) {
      const createSubProjectResponse = await page.request.post(`/api/departments/${department.id}/sub-projects`, {
        headers: authHeaders,
        data: { name: '1号楼', code: `RET-${Date.now()}`, description: '退库 Excel 浏览器验收子项目' },
      });
      expect(createSubProjectResponse.status()).toBe(201);
      const createSubProjectBody = await readJson(createSubProjectResponse);
      subProject = createSubProjectBody?.data;
    }
    expect(subProject?.id).toBeTruthy();

    const materialName = '举例：水泥42.5';
    const existingMaterialResponse = await page.request.get(`/api/wms/materials?name=${encodeURIComponent(materialName)}`, {
      headers: authHeaders,
    });
    expect(existingMaterialResponse.status()).toBe(200);
    const existingMaterialBody = await readJson(existingMaterialResponse);
    if (!(existingMaterialBody?.data || []).some((item: any) => item.name === materialName)) {
      const createMaterialResponse = await page.request.post('/api/wms/materials', {
        headers: authHeaders,
        data: { name: materialName, unit: '吨', unitPrice: 350, category: '退库测试材料' },
      });
      expect(createMaterialResponse.status()).toBe(201);
    }

    await page.goto('/wms/returns');
    await expect(page.getByRole('heading', { name: '退库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增退库' }).click();
    await page.locator('select').filter({ hasText: '请选择子项目' }).selectOption(subProject.id);
    await page.getByText('Excel 退库').click();
    await page.locator('input[type="date"]').last().fill('2026-06-23');

    const templateDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载退库模板' }).click();
    const templateDownload = await templateDownloadPromise;
    expect(templateDownload.suggestedFilename()).toMatch(/^(退库模板|return_template)\.xlsx$/);
    const templatePath = await templateDownload.path();
    expect(templatePath).toBeTruthy();

    await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles(templatePath!);
    await expect(page.getByRole('button', { name: '开始退库' })).toBeEnabled();
    await page.getByRole('button', { name: '开始退库' }).click();
    await expectToast(page, 'Excel 退库成功！');

    const importedResponse = await page.request.get(`/api/wms/returns?subProjectId=${subProject.id}&pageSize=10`, {
      headers: authHeaders,
    });
    expect(importedResponse.status()).toBe(200);
    const importedBody = await readJson(importedResponse);
    const importedReturn = (importedBody?.data || []).find((order: any) =>
      order.source === 'excel'
      && order.subProjectId === subProject.id
      && (order.items || []).some((item: any) => (item.material?.name || item.materialName) === materialName)
    );
    expect(importedReturn?.id).toBeTruthy();
    expect(importedReturn?.orderNo).toBeTruthy();

    await page.goto('/wms/returns');
    await expect(page.locator('tr', { hasText: importedReturn.orderNo })).toBeVisible();
    const returnExportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出退库记录' }).click();
    expect((await returnExportPromise).suggestedFilename()).toBe('退库记录.xlsx');
    await expectToast(page, '退库记录已导出');

    const rowForDelete = page.locator('tr', { hasText: importedReturn.orderNo });
    await rowForDelete.getByTitle('删除').click();
    await expect(page.getByRole('heading', { name: '确认删除退库单' })).toBeVisible();
    const deleteDialog = page.locator('.fixed').filter({ hasText: '确认删除退库单' }).last();
    await expect(deleteDialog.getByText(importedReturn.orderNo)).toBeVisible();
    await expect(deleteDialog.getByText('库存影响（将扣回以下库存）')).toBeVisible();
    await expect(deleteDialog.getByText(materialName)).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expectToast(page, '退库单已删除，可在回收站恢复');
    await expect(page.locator('tr', { hasText: importedReturn.orderNo })).toHaveCount(0);

    const afterDeleteResponse = await page.request.get(`/api/wms/returns?subProjectId=${subProject.id}&pageSize=20`, {
      headers: authHeaders,
    });
    expect(afterDeleteResponse.status()).toBe(200);
    const afterDeleteBody = await readJson(afterDeleteResponse);
    expect((afterDeleteBody?.data || []).some((order: any) => order.id === importedReturn.id)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/退库导入导出删除预览.png',
      fullPage: true,
    });
  });

  test('enterprise user can create export and delete wms outbound records with cascade preview', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const stamp = Date.now();
    const materialName = `浏览器出库导出物资-${stamp}`;
    const projectName = `出库导出项目-${stamp}`;
    const supplierName = `出库导出供应商-${stamp}`;
    const inboundRemark = `出库前置入库-${stamp}`;
    const outboundRemark = `出库导出删除-${stamp}`;

    const departmentsResponse = await page.request.get('/api/departments?pageSize=100', { headers: authHeaders });
    expect(departmentsResponse.status()).toBe(200);
    const departmentsBody = await readJson(departmentsResponse);
    const department = (departmentsBody?.data || []).find((item: any) => item.name === '第一项目部') || (departmentsBody?.data || [])[0];
    expect(department?.id).toBeTruthy();

    const inboundResponse = await page.request.post('/api/wms/inbound', {
      headers: authHeaders,
      data: {
        departmentId: department.id,
        supplierName,
        inboundDate: '2026-06-23',
        remark: inboundRemark,
        items: [
          { materialName, projectName, unit: '件', quantity: 9, actualQty: 9, unitPrice: 18 },
        ],
      },
    });
    expect(inboundResponse.status()).toBe(201);

    await page.goto('/wms/outbound');
    await expect(page.getByRole('heading', { name: '出库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增出库' }).click();
    await chooseMultiSelectModalOption(page, '请选择项目部', /选择项目部/, department.name);
    await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
    await selectFirstRealOption(page.locator('select').filter({ hasText: '请选择班组' }));
    await page.getByPlaceholder('可选').fill(outboundRemark);
    const outboundMaterialRow = page.locator('tr', { hasText: materialName }).first();
    await outboundMaterialRow.locator('input[type="checkbox"]').check();
    await outboundMaterialRow.locator('input[type="number"]').fill('4');
    await page.getByRole('button', { name: /确认出库/ }).click();
    await expect(page.getByRole('heading', { name: '出库成功' })).toBeVisible();

    const outboundPdfPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /下载出库单 PDF/ }).click();
    expect((await outboundPdfPromise).suggestedFilename()).toMatch(/^出库单-.*\.pdf$/);
    await page.getByRole('button', { name: '返回继续出库' }).click();
    await expect(page.getByRole('heading', { name: '出库管理' })).toBeVisible();
    await expect(page.locator('tr', { hasText: outboundRemark })).toBeVisible();

    const createdResponse = await page.request.get('/api/wms/outbound?pageSize=20', { headers: authHeaders });
    expect(createdResponse.status()).toBe(200);
    const createdBody = await readJson(createdResponse);
    const createdOutbound = (createdBody?.data || []).find((order: any) =>
      order.remark === outboundRemark
      && (order.items || []).some((item: any) => (item.material?.name || item.materialName) === materialName)
    );
    expect(createdOutbound?.id).toBeTruthy();
    expect(createdOutbound?.orderNo).toBeTruthy();

    const outboundExportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出出库记录' }).click();
    expect((await outboundExportPromise).suggestedFilename()).toBe('出库记录.xlsx');
    await expectToast(page, '出库记录已导出');

    const rowForDelete = page.locator('tr', { hasText: createdOutbound.orderNo });
    await rowForDelete.getByTitle('删除').click();
    await expect(page.getByRole('heading', { name: '确认删除出库单' })).toBeVisible();
    const deleteDialog = page.locator('.fixed').filter({ hasText: '确认删除出库单' }).last();
    await expect(deleteDialog.getByText(createdOutbound.orderNo)).toBeVisible();
    await expect(deleteDialog.getByText('库存影响（将恢复以下库存）')).toBeVisible();
    await expect(deleteDialog.getByText(materialName)).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expectToast(page, '出库单已删除，可在回收站恢复');
    await expect(page.locator('tr', { hasText: createdOutbound.orderNo })).toHaveCount(0);

    const afterDeleteResponse = await page.request.get('/api/wms/outbound?pageSize=50', { headers: authHeaders });
    expect(afterDeleteResponse.status()).toBe(200);
    const afterDeleteBody = await readJson(afterDeleteResponse);
    expect((afterDeleteBody?.data || []).some((order: any) => order.id === createdOutbound.id)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/出库导出删除预览.png',
      fullPage: true,
    });
  });

  test('enterprise user can create export and delete wms transfer records with cascade preview', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const stamp = Date.now();
    const materialName = `浏览器调拨导出物资-${stamp}`;
    const projectName = `调拨导出项目-${stamp}`;
    const supplierName = `调拨导出供应商-${stamp}`;
    const transferRemark = `调拨导出删除-${stamp}`;

    const departmentsResponse = await page.request.get('/api/departments?pageSize=100', { headers: authHeaders });
    expect(departmentsResponse.status()).toBe(200);
    const departmentsBody = await readJson(departmentsResponse);
    const firstDepartment = (departmentsBody?.data || []).find((item: any) => item.name === '第一项目部') || (departmentsBody?.data || [])[0];
    const secondDepartment = (departmentsBody?.data || []).find((item: any) => item.name === '第二项目部') || (departmentsBody?.data || [])[1];
    expect(firstDepartment?.id).toBeTruthy();
    expect(secondDepartment?.id).toBeTruthy();

    const inboundResponse = await page.request.post('/api/wms/inbound', {
      headers: authHeaders,
      data: {
        departmentId: firstDepartment.id,
        supplierName,
        inboundDate: '2026-06-23',
        remark: `调拨前置入库-${stamp}`,
        items: [
          { materialName, projectName, unit: '件', quantity: 7, actualQty: 7, unitPrice: 16 },
        ],
      },
    });
    expect(inboundResponse.status()).toBe(201);

    await page.goto('/wms/transfers');
    await expect(page.getByRole('heading', { name: '物资调拨' })).toBeVisible();
    await page.getByRole('button', { name: '新增调拨' }).click();
    await chooseMultiSelectModalOption(page, '请选择项目部', /选择调出项目部/, firstDepartment.name);
    await chooseSingleSelectModalOption(page, '请选择项目部', /选择调入项目部/, secondDepartment.name);
    await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('可选').fill(transferRemark);
    const transferMaterialRow = page.locator('tr', { hasText: materialName }).first();
    await transferMaterialRow.locator('input[type="checkbox"]').check();
    await transferMaterialRow.locator('input[type="number"]').fill('3');
    await page.getByRole('button', { name: /确认调拨/ }).click();
    await expectToast(page, '调拨成功');
    await expect(page.locator('tr', { hasText: transferRemark })).toBeVisible();
    await expect(page.locator('tr', { hasText: transferRemark })).toContainText(firstDepartment.name);
    await expect(page.locator('tr', { hasText: transferRemark })).toContainText(secondDepartment.name);

    const createdResponse = await page.request.get('/api/wms/transfers?pageSize=20', { headers: authHeaders });
    expect(createdResponse.status()).toBe(200);
    const createdBody = await readJson(createdResponse);
    const createdTransfer = (createdBody?.data || []).find((order: any) =>
      order.remark === transferRemark
      && order.fromDepartmentId === firstDepartment.id
      && order.toDepartmentId === secondDepartment.id
      && (order.items || []).some((item: any) => (item.material?.name || item.materialName) === materialName)
    );
    expect(createdTransfer?.id).toBeTruthy();
    expect(createdTransfer?.orderNo).toBeTruthy();

    const transferDownloadPromise = page.waitForEvent('download');
    await page.locator('tr', { hasText: transferRemark }).getByTitle('下载调拨单').click();
    expect((await transferDownloadPromise).suggestedFilename()).toMatch(/^调拨单-.*\.pdf$/);

    const transferExportPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出调拨记录' }).click();
    expect((await transferExportPromise).suggestedFilename()).toBe('调拨记录.xlsx');
    await expectToast(page, '调拨记录已导出');

    const rowForDelete = page.locator('tr', { hasText: createdTransfer.orderNo });
    await rowForDelete.getByTitle('删除').click();
    await expect(page.getByRole('heading', { name: '确认删除调拨单' })).toBeVisible();
    const deleteDialog = page.locator('.fixed').filter({ hasText: '确认删除调拨单' }).last();
    await expect(deleteDialog.getByText(createdTransfer.orderNo)).toBeVisible();
    await expect(deleteDialog.getByText('库存影响（将反向恢复库存）')).toBeVisible();
    await expect(deleteDialog.getByText(materialName).first()).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expectToast(page, '调拨单已删除，可在回收站恢复');
    await expect(page.locator('tr', { hasText: createdTransfer.orderNo })).toHaveCount(0);

    const afterDeleteResponse = await page.request.get('/api/wms/transfers?pageSize=50', { headers: authHeaders });
    expect(afterDeleteResponse.status()).toBe(200);
    const afterDeleteBody = await readJson(afterDeleteResponse);
    expect((afterDeleteBody?.data || []).some((order: any) => order.id === createdTransfer.id)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/调拨导出删除预览.png',
      fullPage: true,
    });
  });

  test('enterprise user can export wms inventory and work team ledger with net quantities', async ({ page }) => {
    test.setTimeout(150_000);
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const stamp = Date.now();
    const materialName = `浏览器库存台账物资-${stamp}`;
    const projectName = `库存台账项目-${stamp}`;
    const supplierName = `库存台账供应商-${stamp}`;
    const outboundRemark = `库存台账出库-${stamp}`;
    const returnRemark = `库存台账退库-${stamp}`;

    const departmentsResponse = await page.request.get('/api/departments?pageSize=100', { headers: authHeaders });
    expect(departmentsResponse.status()).toBe(200);
    const departmentsBody = await readJson(departmentsResponse);
    const department = (departmentsBody?.data || []).find((item: any) => item.name === '第一项目部') || (departmentsBody?.data || [])[0];
    expect(department?.id).toBeTruthy();

    const inboundResponse = await page.request.post('/api/wms/inbound', {
      headers: authHeaders,
      data: {
        departmentId: department.id,
        supplierName,
        inboundDate: '2026-06-23',
        remark: `库存台账前置入库-${stamp}`,
        items: [
          { materialName, projectName, unit: '件', quantity: 10, actualQty: 10, unitPrice: 11 },
        ],
      },
    });
    expect(inboundResponse.status()).toBe(201);

    await page.goto('/wms/outbound');
    await expect(page.getByRole('heading', { name: '出库管理' })).toBeVisible();
    await page.getByRole('button', { name: '新增出库' }).click();
    await chooseMultiSelectModalOption(page, '请选择项目部', /选择项目部/, department.name);
    await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
    await selectFirstRealOption(page.locator('select').filter({ hasText: '请选择班组' }));
    await page.getByPlaceholder('可选').fill(outboundRemark);
    const outboundMaterialRow = page.locator('tr', { hasText: materialName }).first();
    await outboundMaterialRow.locator('input[type="checkbox"]').check();
    await outboundMaterialRow.locator('input[type="number"]').fill('4');
    await page.getByRole('button', { name: /确认出库/ }).click();
    await expect(page.getByRole('heading', { name: '出库成功' })).toBeVisible();
    await page.getByRole('button', { name: '返回继续出库' }).click();

    const outboundResponse = await page.request.get('/api/wms/outbound?pageSize=20', { headers: authHeaders });
    expect(outboundResponse.status()).toBe(200);
    const outboundBody = await readJson(outboundResponse);
    const outboundOrder = (outboundBody?.data || []).find((order: any) =>
      order.remark === outboundRemark
      && (order.items || []).some((item: any) => (item.material?.name || item.materialName) === materialName)
    );
    expect(outboundOrder?.id).toBeTruthy();

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
    await expectToast(page, '退库成功');
    await page.keyboard.press('Escape');

    const inventoryResponse = await page.request.get(`/api/wms/inventory?materialName=${encodeURIComponent(materialName)}&pageSize=20`, {
      headers: authHeaders,
    });
    expect(inventoryResponse.status()).toBe(200);
    const inventoryBody = await readJson(inventoryResponse);
    const inventoryRow = (inventoryBody?.data || []).find((item: any) => item.material?.name === materialName);
    expect(inventoryRow?.quantity).toBe(7);

    await page.goto('/wms/materials');
    await expect(page.getByRole('heading', { name: '物资总览' })).toBeVisible();
    await page.getByRole('button', { name: '按物资汇总' }).click();
    await page.getByPlaceholder('搜索物资名称...').fill(materialName);
    await expect(page.locator('tr', { hasText: materialName })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tr', { hasText: materialName })).toContainText('7');
    const inventoryDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出库存' }).click();
    expect((await inventoryDownloadPromise).suggestedFilename()).toBe('库存汇总.xlsx');
    await expectToast(page, '库存记录已导出');

    await page.getByRole('button', { name: '已出库' }).click();
    await expect(page.getByPlaceholder('搜索物资名称...')).toHaveValue(materialName);
    await expect(page.locator('tr', { hasText: materialName })).toBeVisible({ timeout: 15000 });
    const outboundInventoryDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出已出库' }).click();
    expect((await outboundInventoryDownloadPromise).suggestedFilename()).toBe('已出库库存.xlsx');
    await expectToast(page, '已出库记录已导出');

    const ledgerResponse = await page.request.get(`/api/wms/work-team-ledger?keyword=${encodeURIComponent(materialName)}&pageSize=20`, {
      headers: authHeaders,
    });
    expect(ledgerResponse.status()).toBe(200);
    const ledgerBody = await readJson(ledgerResponse);
    const ledgerRow = (ledgerBody?.data || []).find((item: any) => item.materialName === materialName);
    expect(ledgerRow?.quantity).toBe(3);
    expect(ledgerRow?.returnedQuantity).toBe(1);

    await page.goto('/wms/ledger');
    await expect(page.getByRole('heading', { name: '班组台账' })).toBeVisible();
    await page.getByPlaceholder('搜索班组/物资名称...').fill(materialName);
    await expect(page.locator('tr', { hasText: materialName })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tr', { hasText: materialName })).toContainText('3');
    const ledgerDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出班组台账' }).click();
    expect((await ledgerDownloadPromise).suggestedFilename()).toBe('班组台账.xlsx');
    await expectToast(page, '班组台账已导出');

    await page.screenshot({
      path: '../docs/smoke-evidence/库存台账导出净数量.png',
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
    const token = await page.evaluate(() => localStorage.getItem('zlt_token'));
    expect(token).toBeTruthy();
    const stamp = Date.now();
    const month = '2026-06';
    const deleteRecipientName = `浏览器发放删除-${stamp}`;
    const deleteIdCardNo = generateValidIdCard(stamp, '19900201');
    const recipientName = `浏览器发放导出-${stamp}`;
    const idCardNo = generateValidIdCard(stamp + 1, '19900301');

    await page.goto('/labor/payment');
    await expect(page.getByRole('heading', { name: '工资发放' })).toBeVisible();

    await page.getByRole('button', { name: '新增发放' }).click();
    await page.getByPlaceholder('收款人姓名').fill(deleteRecipientName);
    await page.getByPlaceholder('18位身份证号').fill(deleteIdCardNo);
    await page.getByPlaceholder('0.00').fill('55.55');
    await page.locator('input[type="month"]').fill(month);
    await page.getByPlaceholder('银行卡号').fill('6222020202020202055');
    await page.getByPlaceholder('备注').fill('真实浏览器工资发放删除验收');
    await page.getByRole('button', { name: '确认发放' }).click();
    await expectToast(page, '发放记录创建成功');
    const deleteRow = page.locator('tr', { hasText: deleteRecipientName });
    await expect(deleteRow).toBeVisible();
    await expect(deleteRow).toContainText('待确认');
    await expect(deleteRow).toContainText('6222020202020202055');
    const deleteCandidateResponse = await page.request.get(`/api/labor/payment?search=${encodeURIComponent(deleteRecipientName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteCandidateResponse.status()).toBe(200);
    const deleteCandidateBody = await readJson(deleteCandidateResponse);
    const deleteCandidate = deleteCandidateBody?.data?.records?.find((item: any) => item.recipientName === deleteRecipientName);
    expect(deleteCandidate?.isConfirmed).toBe(false);
    expect(deleteCandidate?.bankAccount).toBe('6222020202020202055');
    page.once('dialog', dialog => dialog.accept());
    await deleteRow.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('发放记录已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: deleteRecipientName })).toHaveCount(0);
    const deletedLookupResponse = await page.request.get(`/api/labor/payment?search=${encodeURIComponent(deleteRecipientName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deletedLookupResponse.status()).toBe(200);
    const deletedLookupBody = await readJson(deletedLookupResponse);
    expect((deletedLookupBody?.data?.records || []).some((item: any) => item.recipientName === deleteRecipientName)).toBe(false);

    await page.getByRole('button', { name: '新增发放' }).click();
    await page.getByPlaceholder('收款人姓名').fill(recipientName);
    await page.getByPlaceholder('18位身份证号').fill(idCardNo);
    await page.getByPlaceholder('0.00').fill('88.66');
    await page.locator('input[type="month"]').fill(month);
    await page.getByPlaceholder('银行卡号').fill('6222020202020202020');
    await page.getByPlaceholder('备注').fill('真实浏览器工资发放导出验收');
    await page.getByRole('button', { name: '确认发放' }).click();
    await expectToast(page, '发放记录创建成功');
    const paymentRow = page.locator('tr', { hasText: recipientName });
    await expect(paymentRow).toBeVisible();
    await expect(paymentRow).toContainText('待确认');
    await expect(paymentRow).toContainText('6222020202020202020');
    const paymentLookupResponse = await page.request.get(`/api/labor/payment?search=${encodeURIComponent(recipientName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(paymentLookupResponse.status()).toBe(200);
    const paymentLookupBody = await readJson(paymentLookupResponse);
    const paymentRecord = paymentLookupBody?.data?.records?.find((item: any) => item.recipientName === recipientName);
    expect(paymentRecord?.isConfirmed).toBe(false);
    expect(paymentRecord?.bankAccount).toBe('6222020202020202020');
    await paymentRow.getByRole('button', { name: '确认' }).click();
    await expect(page.getByText('已确认')).toBeVisible();
    await expect(paymentRow).toContainText('已入账不可删');
    const confirmedDeleteResponse = await page.request.delete(`/api/labor/payment/${paymentRecord.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(confirmedDeleteResponse.status()).toBe(400);
    const confirmedDeleteBody = await readJson(confirmedDeleteResponse);
    expect(confirmedDeleteBody?.message).toContain('不可删除');

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
    const reportTypeSelect = page.locator('select').nth(1);
    async function expectTypedReportExport(type: string, title: string, expectedSheet: string) {
      await reportTypeSelect.selectOption(type);
      await expect(reportTypeSelect).toHaveValue(type);
      const response = await page.request.get(`/api/labor/reports/export?months=${month}&type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);
      expect(await workbookSheetNames(response)).toEqual([expectedSheet]);
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /导出 Excel/ }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`${month}-${title}.xlsx`);
      await expectToast(page, '报表导出成功');
    }

    await expectTypedReportExport('salary', '月度工资汇总表', '月度工资汇总表');
    await expectTypedReportExport('social', '社保缴纳明细表', '社保缴纳明细表');

    await reportTypeSelect.selectOption('payment');
    await expect(page.getByText(new RegExp(`${month} 工资发放明细表`))).toBeVisible();
    await expect(page.getByText(recipientName)).toBeVisible({ timeout: 10000 });
    await expectTypedReportExport('payment', '工资发放明细表', '工资发放明细表');

    await reportTypeSelect.selectOption('attendance');
    await expect(page.getByText(new RegExp(`${month} 月度考勤汇总表`))).toBeVisible();
    await expect(page.getByText(recipientName)).toHaveCount(0);
    await expectTypedReportExport('attendance', '月度考勤汇总表', '月度考勤汇总表');

    const invalidReportResponse = await page.request.get(`/api/labor/reports/export?months=${month}&type=unknown`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(invalidReportResponse.status()).toBe(400);
    const invalidReportBody = await readJson(invalidReportResponse);
    expect(invalidReportBody?.error).toBe('INVALID_REPORT_TYPE');

    const legacyAllReportResponse = await page.request.get(`/api/labor/reports/export?months=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(legacyAllReportResponse.status()).toBe(200);
    expect(await workbookSheetNames(legacyAllReportResponse)).toEqual([
      '月度工资汇总表',
      '欠薪统计表',
      '异常人员明细表',
      '工资发放记录表',
    ]);

    await page.screenshot({
      path: '../docs/smoke-evidence/劳资工资发放导出.png',
      fullPage: true,
    });
  });

  test('enterprise user can exercise legacy labor subcontract output value API chain', async ({ page }) => {
    await loginEnterprise(page);
    const token = await page.evaluate(() => localStorage.getItem('zlt_token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const stamp = Date.now();
    const month = '2026-06';

    const contractResponse = await page.request.post('/api/contracts', {
      headers: authHeaders,
      data: {
        type: 'CONSTRUCTION',
        name: `浏览器劳资旧产值承包合同-${stamp}`,
        code: `LAB-OUTPUT-${stamp}`,
        totalAmount: 50000,
      },
    });
    expect(contractResponse.status()).toBe(201);
    const contractBody = await readJson(contractResponse);
    const contractId = contractBody?.data?.id;
    expect(contractId).toBeTruthy();

    const subcontractorResponse = await page.request.post('/api/labor/subcontractor', {
      headers: authHeaders,
      data: {
        type: 'company',
        companyName: `浏览器劳资旧产值分包商-${stamp}`,
        contactName: `旧产值联系人-${stamp}`,
        contactPhone: `136${String(stamp).slice(-8)}`,
        bankAccount: '6222020202020202099',
        bankName: '浏览器验收银行',
        remark: '真实登录会话验证劳资旧分包商 API',
      },
    });
    expect(subcontractorResponse.status()).toBe(201);
    const subcontractorBody = await readJson(subcontractorResponse);
    const subcontractorId = subcontractorBody?.data?.id;
    expect(subcontractorId).toBeTruthy();

    const subContractResponse = await page.request.post('/api/labor/sub-contract', {
      headers: authHeaders,
      data: {
        contractId,
        subcontractorId,
        name: `浏览器劳资旧产值分包合同-${stamp}`,
        totalAmount: 30000,
      },
    });
    expect(subContractResponse.status()).toBe(201);
    const subContractBody = await readJson(subContractResponse);
    const subContractId = subContractBody?.data?.id;
    expect(subContractId).toBeTruthy();

    const outputValueResponse = await page.request.post('/api/labor/output-value', {
      headers: authHeaders,
      data: {
        subContractId,
        month,
        amount: 12000,
        payableRatio: 0.8,
        remark: '真实登录会话验证劳资产值录入',
      },
    });
    expect(outputValueResponse.status()).toBe(201);
    const outputValueBody = await readJson(outputValueResponse);
    const outputValueId = outputValueBody?.data?.id;
    expect(outputValueId).toBeTruthy();

    const progressPaymentResponse = await page.request.post('/api/labor/output-value/payments', {
      headers: authHeaders,
      data: {
        subContractId,
        totalAmount: 9600,
        outputValueIds: [outputValueId],
        paidAt: '2026-06-24',
        remark: '真实登录会话验证分包进度款',
      },
    });
    expect(progressPaymentResponse.status()).toBe(201);
    const progressPaymentBody = await readJson(progressPaymentResponse);
    expect(progressPaymentBody?.message).toBe('进度款支付记录创建成功');
    expect(progressPaymentBody?.data?.subContractId).toBe(subContractId);
    expect(Number(progressPaymentBody?.data?.totalAmount)).toBe(9600);

    const outputListResponse = await page.request.get(`/api/labor/output-value?subContractId=${subContractId}&month=${month}`, {
      headers: authHeaders,
    });
    expect(outputListResponse.status()).toBe(200);
    const outputListBody = await readJson(outputListResponse);
    const outputRecord = (outputListBody?.data || []).find((item: any) => item.id === outputValueId);
    expect(outputRecord?.subContractId).toBe(subContractId);
    expect(Number(outputRecord?.amount)).toBe(12000);

    const subContractListResponse = await page.request.get(`/api/labor/sub-contract?contractId=${contractId}&subcontractorId=${subcontractorId}`, {
      headers: authHeaders,
    });
    expect(subContractListResponse.status()).toBe(200);
    const subContractListBody = await readJson(subContractListResponse);
    expect((subContractListBody?.data?.contracts || []).some((item: any) => item.id === subContractId)).toBe(true);

    const deleteSubContractResponse = await page.request.delete(`/api/labor/sub-contract/${subContractId}`, { headers: authHeaders });
    expect(deleteSubContractResponse.status()).toBe(200);
    const deleteSubcontractorResponse = await page.request.delete(`/api/labor/subcontractor/${subcontractorId}`, { headers: authHeaders });
    expect(deleteSubcontractorResponse.status()).toBe(200);
    const deleteContractResponse = await page.request.delete(`/api/contracts/${contractId}`, { headers: authHeaders });
    expect(deleteContractResponse.status()).toBe(200);

    await page.goto('/labor/payment');
    await expect(page.getByRole('heading', { name: '工资发放' })).toBeVisible();
    await page.screenshot({
      path: '../docs/smoke-evidence/劳资分包产值旧API链路.png',
      fullPage: true,
    });
  });

  test('enterprise user can complete labor personnel attendance salary and risk CRUD', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const month = '2026-06';
    const anomalyMonth = '2026-05';
    const personName = `浏览器劳资深测-${stamp}`;
    const editedPersonName = `${personName}-已编辑`;
    const idCardNo = generateValidIdCard(stamp);
    const phone = `137${String(stamp).slice(-8)}`;
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();

    await page.goto('/labor/personnel');
    await expect(page.getByRole('heading', { name: '人员管理' })).toBeVisible();
    await page.getByRole('button', { name: /新增项目部人员/ }).click();
    await page.getByPlaceholder('姓名', { exact: true }).fill(personName);
    await page.getByPlaceholder('联系电话').fill(phone);
    await page.getByPlaceholder('18位身份证号').fill(idCardNo);
    await page.locator('input[type="date"]').fill('2026-06-01');
    await page.locator('select').filter({ hasText: '请选择项目部' }).selectOption({ label: '第一项目部' });
    await page.locator('input[type="number"]').first().fill('6000');
    const createDialog = page.locator('.fixed').filter({ hasText: '新增项目部人员' }).last();
    await createDialog.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('人员添加成功')).toBeVisible();
    await page.getByPlaceholder('姓名/身份证号').fill(personName);
    await expect(page.locator('tr', { hasText: personName })).toBeVisible();
    const personnelResponse = await page.request.get(`/api/labor/personnel?search=${encodeURIComponent(idCardNo)}&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(personnelResponse.status()).toBe(200);
    const personnelBody = await readJson(personnelResponse);
    const createdPersonnel = (personnelBody?.data?.personnel || []).find((item: any) => item.idCardNo === idCardNo);
    expect(createdPersonnel?.id).toBeTruthy();

    const personRow = page.locator('tr', { hasText: personName });
    await personRow.getByTitle('编辑').click();
    await expect(page.getByRole('heading', { name: '编辑人员信息' })).toBeVisible();
    await page.getByPlaceholder('姓名', { exact: true }).fill(editedPersonName);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('更新成功')).toBeVisible();
    await page.getByPlaceholder('姓名/身份证号').fill(editedPersonName);
    await expect(page.locator('tr', { hasText: editedPersonName })).toBeVisible();

    await page.locator('tr', { hasText: editedPersonName }).getByTitle('查看详情').click();
    await expect(page.getByRole('heading', { name: new RegExp(`人员详情 — ${editedPersonName}`) })).toBeVisible();
    const detailDialog = page.locator('.fixed').filter({ hasText: `人员详情 — ${editedPersonName}` }).last();
    await detailDialog.getByText('上传文件').first().click();
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/contract-attachment.pdf'));
    await expect(page.getByText('已上传 1 个文件')).toBeVisible({ timeout: 10000 });
    await expect(detailDialog.getByRole('link', { name: 'contract-attachment.pdf' })).toBeVisible();
    const personnelAttachmentDownloadPromise = page.waitForEvent('download');
    await detailDialog.getByRole('link', { name: 'contract-attachment.pdf' }).click();
    expect((await personnelAttachmentDownloadPromise).suggestedFilename()).toBe('contract-attachment.pdf');
    await detailDialog.locator('.group', { hasText: 'contract-attachment.pdf' }).locator('button').click();
    await expect(page.getByText('附件已删除')).toBeVisible();
    await expect(detailDialog.getByRole('link', { name: 'contract-attachment.pdf' })).toHaveCount(0);
    await page.getByTitle('关闭').click();

    await page.locator('tr', { hasText: editedPersonName }).getByTitle('登记离职').click();
    await page.locator('input[type="date"]').fill('2026-06-23');
    await page.getByRole('button', { name: '确认离职' }).click();
    await expect(page.getByText('离职登记成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: editedPersonName })).toHaveCount(0);
    await page.getByRole('button', { name: '离职' }).click();
    await expect(page.locator('tr', { hasText: editedPersonName })).toBeVisible();
    await page.locator('tr', { hasText: editedPersonName }).getByTitle('复职').click();
    await expect(page.getByText('复职成功')).toBeVisible();
    await page.getByRole('button', { name: '在职' }).click();
    await expect(page.locator('tr', { hasText: editedPersonName })).toBeVisible();

    await page.goto('/labor/attendance');
    await expect(page.getByRole('heading', { name: '考勤管理' })).toBeVisible();
    await page.locator('select').filter({ hasText: '本地测试 / Stub' }).selectOption('http');
    await page.getByRole('button', { name: '检测人脸网关' }).click();
    const faceProviderStatusCard = page.locator('.rounded-lg', { hasText: '人脸网关状态' }).last();
    await expect(faceProviderStatusCard.getByText(/人脸网关状态：未就绪/)).toBeVisible();
    await expect(faceProviderStatusCard.getByText(/FACE_RECOGNITION_HTTP_ENDPOINT/)).toBeVisible();
    await page.locator('select').filter({ hasText: '本地测试 / Stub' }).selectOption('stub');
    await page.getByRole('button', { name: '检测人脸网关' }).click();
    await expect(faceProviderStatusCard.getByText(/人脸网关状态：已就绪/)).toBeVisible();
    await page.getByPlaceholder('搜索姓名').fill(editedPersonName);
    await expect(page.getByText(editedPersonName).first()).toBeVisible();
    await page.getByText(editedPersonName).first().click();
    await page.locator('input[type="date"]').fill('2026-06-21');
    await page.getByRole('button', { name: '1.5天' }).click();
    await page.locator('select').filter({ hasText: '无加班' }).selectOption('HALF');
    await page.getByRole('button', { name: /录入 1 人/ }).click();
    await expect(page.getByText('已为 1 人录入考勤')).toBeVisible();
    await page.getByText(editedPersonName).first().click();
    await page.getByRole('button', { name: '为已选人员补卡' }).click();
    await expect(page.getByRole('heading', { name: '批量补卡' })).toBeVisible();
    await page.getByRole('button', { name: '22' }).click();
    await page.getByRole('button', { name: /提交补卡/ }).click();
    await expect(page.getByRole('heading', { name: '批量补卡' })).toHaveCount(0);
    const attendanceResponse = await page.request.get(`/api/labor/attendance/monthly?month=${month}&personnelId=${createdPersonnel.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(attendanceResponse.status()).toBe(200);
    const attendanceBody = await readJson(attendanceResponse);
    const attendanceSummary = attendanceBody?.data?.[0];
    expect(attendanceSummary?.records?.length).toBeGreaterThanOrEqual(2);

    await page.goto('/labor/salary');
    await expect(page.getByRole('heading', { name: '工资核算' })).toBeVisible();
    await page.locator('input[type="month"]').fill(month);
    await page.getByRole('button', { name: '工资核算' }).click();
    await expect(page.getByRole('heading', { name: '工资自动核算' })).toBeVisible();
    await page.getByRole('button', { name: '开始核算' }).click();
    await expect(page.getByText(/核算完成/)).toBeVisible({ timeout: 15000 });
    const salaryRow = page.locator('tr', { hasText: editedPersonName });
    await expect(salaryRow).toBeVisible();
    await salaryRow.getByTitle('手动调整工资').click();
    await expect(page.getByRole('heading', { name: '手动调整工资' })).toBeVisible();
    await page.locator('.fixed').filter({ hasText: '手动调整工资' }).last().locator('input[type="number"]').first().fill('1234.56');
    await page.getByPlaceholder('请输入调整原因').fill('真实浏览器工资手动调整');
    await page.getByRole('button', { name: '保存调整' }).click();
    await expect(page.getByText('工资记录修改成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: editedPersonName })).toContainText('¥1,234.56');
    const laborSalaryDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出报表/ }).click();
    expect((await laborSalaryDownloadPromise).suggestedFilename()).toBe(`${month}工资核算明细.xlsx`);

    const paymentResponse = await page.request.post('/api/labor/payment', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        recipientName: editedPersonName,
        idCardNo,
        amount: 321,
        paymentDate: '2026-05-20',
        month: anomalyMonth,
        paymentMethod: 'bank',
        remark: '真实浏览器风控异常触发',
      },
    });
    expect(paymentResponse.status()).toBe(201);
    const paymentBody = await readJson(paymentResponse);
    const confirmRiskPaymentResponse = await page.request.post('/api/labor/payment/confirm-batch', {
      headers: { Authorization: `Bearer ${token}` },
      data: { ids: [paymentBody?.data?.id] },
    });
    expect(confirmRiskPaymentResponse.status()).toBe(200);

    await page.goto('/labor/risk');
    await expect(page.getByRole('heading', { name: '风控管理' })).toBeVisible();
    await expect(page.locator('tr', { hasText: editedPersonName })).toBeVisible({ timeout: 10000 });
    await page.locator('tr', { hasText: editedPersonName }).getByRole('button', { name: '处理' }).click();
    await page.getByPlaceholder('备注说明').fill('真实浏览器处理异常记录');
    await page.getByRole('button', { name: '确认处理' }).click();
    await expect(page.getByText('异常已处理')).toBeVisible();
    await page.getByText('合规检查').click();
    await expect(page.getByText('合规检查')).toBeVisible();

    await page.screenshot({
      path: '../docs/smoke-evidence/劳资人员考勤工资风控CRUD.png',
      fullPage: true,
    });
  });

  test('enterprise user can submit department reimbursement and approve or reject it', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const approveHandler = `项目部报账经办-${stamp}`;
    const rejectHandler = `项目部驳回经办-${stamp}`;
    const approveDetail = `真实浏览器项目部报账审核-${stamp}`;
    const rejectDetail = `真实浏览器项目部报账驳回-${stamp}`;
    const receiptPath = path.resolve(process.cwd(), 'tests/fixtures/checkin-face.svg');

    async function submitDepartmentExpense(handler: string, detail: string, amount: string) {
      await page.goto('/finance/dept-entry');
      await expect(page.getByRole('heading', { name: '项目部报账' })).toBeVisible();
      await page.locator('select').filter({ hasText: '请选择合同' }).selectOption({ label: 'XX市政道路改造工程' });
      await page.locator('select').filter({ hasText: '请选择项目部' }).selectOption({ label: '第一项目部' });
      await page.getByPlaceholder('请输入经办人姓名').fill(handler);
      await page.locator('select').filter({ hasText: '请选择类别' }).selectOption({ label: '材料费' });
      await page.getByPlaceholder('0.00').fill(amount);
      await page.getByPlaceholder('请详细描述费用用途和内容...').fill(detail);
      await page.locator('input[type="file"]').setInputFiles(receiptPath);
      await page.getByRole('button', { name: '提交报账申请' }).click();
      await expect(page.getByText('费用报账提交成功')).toBeVisible();
    }

    await submitDepartmentExpense(approveHandler, approveDetail, '321.09');
    await submitDepartmentExpense(rejectHandler, rejectDetail, '98.76');

    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const createdResponse = await page.request.get(`/api/finance/expenses?keyword=${encodeURIComponent(approveDetail)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(createdResponse.status()).toBe(200);
    const createdBody = await readJson(createdResponse);
    const createdExpense = (createdBody?.data || []).find((item: any) => item.detail === approveDetail);
    expect(createdExpense?.status).toBe('pending');
    expect(createdExpense?.source).toBe('project_department');
    expect(createdExpense?.payer).toBe(approveHandler);
    expect(createdExpense?.receiptPath).toMatch(/^\/uploads\/finance-/);

    await page.goto('/finance/expenses');
    await expect(page.getByRole('heading', { name: '费用列表', exact: true })).toBeVisible();
    await page.getByPlaceholder('经办人/明细...').fill(approveDetail);
    const approveRow = page.locator('tr', { hasText: approveHandler });
    await expect(approveRow).toBeVisible();
    await expect(approveRow).toContainText('待审核');
    await approveRow.locator('button[title="审核通过"]').click();
    await expect(page.getByText('审核通过')).toBeVisible();
    await expect(approveRow).toContainText('已审核');

    const approvedResponse = await page.request.get(`/api/finance/expenses?keyword=${encodeURIComponent(approveDetail)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(approvedResponse.status()).toBe(200);
    const approvedBody = await readJson(approvedResponse);
    const approvedExpense = (approvedBody?.data || []).find((item: any) => item.detail === approveDetail);
    expect(approvedExpense?.status).toBe('approved');
    const approvedDeleteResponse = await page.request.delete(`/api/finance/expenses/${approvedExpense.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(approvedDeleteResponse.status()).toBe(400);
    const approvedDeleteBody = await readJson(approvedDeleteResponse);
    expect(approvedDeleteBody?.code || approvedDeleteBody?.error).toBe('EXPENSE_ALREADY_APPROVED');

    await page.getByPlaceholder('经办人/明细...').fill(rejectDetail);
    const rejectRow = page.locator('tr', { hasText: rejectHandler });
    await expect(rejectRow).toBeVisible();
    await expect(rejectRow).toContainText('待审核');
    await rejectRow.locator('button[title="审核驳回"]').click();
    await expect(page.getByText('已驳回')).toBeVisible();
    await expect(rejectRow).toContainText('已拒绝');

    const rejectedResponse = await page.request.get(`/api/finance/expenses?keyword=${encodeURIComponent(rejectDetail)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(rejectedResponse.status()).toBe(200);
    const rejectedBody = await readJson(rejectedResponse);
    const rejectedExpense = (rejectedBody?.data || []).find((item: any) => item.detail === rejectDetail);
    expect(rejectedExpense?.status).toBe('rejected');

    await rejectRow.locator('button[title="删除"]').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('删除成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: rejectHandler })).toHaveCount(0);

    const afterDeleteResponse = await page.request.get(`/api/finance/expenses?keyword=${encodeURIComponent(rejectDetail)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterDeleteResponse.status()).toBe(200);
    const afterDeleteBody = await readJson(afterDeleteResponse);
    expect((afterDeleteBody?.data || []).some((item: any) => item.detail === rejectDetail)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/项目部报账审核驳回CRUD.png',
      fullPage: true,
    });
  });

  test('enterprise user can complete finance petty cash and expense voucher CRUD', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const holderName = `浏览器备用金-${stamp}`;
    const issuedBy = `浏览器财务-${stamp}`;
    const handler = `浏览器经办-${stamp}`;
    const detail = `真实浏览器财务凭证-${stamp}`;
    const editedDetail = `${detail}-已编辑`;

    await page.goto('/finance/petty-cash');
    await expect(page.getByRole('heading', { name: '备用金管理' })).toBeVisible();
    await page.getByRole('button', { name: '新建账户' }).first().click();
    await page.getByPlaceholder('请输入持卡人姓名').fill(holderName);
    await page.getByPlaceholder('请输入身份证号').fill(`110101199002${String(stamp).slice(-6)}`);
    await page.locator('select').filter({ hasText: '请选择合同' }).selectOption({ label: 'XX市政道路改造工程' });
    await page.locator('select').filter({ hasText: '请选择项目部' }).selectOption({ label: '第一项目部' });
    await page.getByPlaceholder('请输入初始预支金额').fill('1000');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expect(page.getByText('备用金账户创建成功')).toBeVisible();
    await expect(page.getByText(holderName)).toBeVisible();

    await page.getByText(holderName).click();
    await expect(page.getByText('当前余额').first()).toBeVisible();
    await page.getByRole('button', { name: '记录领取' }).click();
    await page.getByPlaceholder('请输入领取金额').fill('250');
    await page.getByPlaceholder('请输入发放人姓名').fill(issuedBy);
    await page.getByPlaceholder('请输入备注信息（选填）').fill('真实浏览器备用金领取');
    await page.getByRole('button', { name: '确认领取' }).click();
    await expect(page.getByText('领取记录已保存')).toBeVisible();
    await expect(page.locator('tr', { hasText: issuedBy })).toBeVisible();

    await page.goto('/finance/finance-entry');
    await expect(page.getByRole('heading', { name: '公司财务凭证' })).toBeVisible();
    await page.locator('select').filter({ hasText: '请选择合同' }).selectOption({ label: 'XX市政道路改造工程' });
    await page.locator('select').filter({ hasText: '请选择项目部' }).selectOption({ label: '第一项目部' });
    await page.getByPlaceholder('请输入经办人姓名').fill(handler);
    await page.locator('select').filter({ hasText: '请选择类别' }).selectOption({ label: '材料费' });
    await page.getByPlaceholder('0.00').fill('123.45');
    await page.getByPlaceholder('请详细描述费用用途和内容...').fill(detail);
    await page.getByPlaceholder('公司付款方名称或支付人').fill('浏览器测试付款方');
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/checkin-face.svg'));
    await page.getByRole('button', { name: '录入财务凭证' }).click();
    await expect(page.getByText('财务凭证录入成功')).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const expenseResponse = await page.request.get(`/api/finance/expenses?keyword=${encodeURIComponent(detail)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(expenseResponse.status()).toBe(200);
    const expenseBody = await readJson(expenseResponse);
    const createdExpense = (expenseBody?.data || []).find((item: any) => item.detail === detail);
    expect(createdExpense?.receiptPath).toMatch(/^\/uploads\/finance-/);

    await page.goto('/finance/expenses');
    await expect(page.getByRole('heading', { name: '费用列表', exact: true })).toBeVisible();
    await page.getByPlaceholder('经办人/明细...').fill(detail);
    const row = page.locator('tr', { hasText: handler });
    await expect(row).toBeVisible();
    await expect(row).toContainText('XX市政道路改造工程');
    await expect(row).toContainText('第一项目部');
    await row.click();
    await expect(page.getByRole('heading', { name: '费用详情' })).toBeVisible();
    await expect(page.getByText(detail)).toBeVisible();
    await page.keyboard.press('Escape');

    await row.locator('button[title="编辑"]').click();
    const editDialog = page.locator('.fixed').filter({ hasText: '编辑费用' }).last();
    await expect(editDialog.getByText('编辑费用')).toBeVisible();
    await editDialog.locator('input[type="number"]').fill('234.56');
    await editDialog.locator('textarea').fill(editedDetail);
    await editDialog.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('修改成功')).toBeVisible();
    await page.getByPlaceholder('经办人/明细...').fill(editedDetail);
    const editedRow = page.locator('tr', { hasText: handler });
    await expect(editedRow).toBeVisible();
    const editedExpenseResponse = await page.request.get(`/api/finance/expenses?keyword=${encodeURIComponent(editedDetail)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(editedExpenseResponse.status()).toBe(200);
    const editedExpenseBody = await readJson(editedExpenseResponse);
    expect((editedExpenseBody?.data || []).some((item: any) => item.detail === editedDetail && Number(item.amount) === 234.56)).toBe(true);

    await editedRow.locator('button[title="删除"]').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('删除成功')).toBeVisible();
    await expect(page.locator('tr', { hasText: handler })).toHaveCount(0);

    await page.screenshot({
      path: '../docs/smoke-evidence/财务备用金费用CRUD上传.png',
      fullPage: true,
    });
  });

  test('enterprise user can verify finance dashboard real summary data', async ({ page }) => {
    await loginEnterprise(page);
    const stamp = Date.now();
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };

    const categoriesResponse = await page.request.get('/api/finance/categories', {
      headers: authHeaders,
    });
    expect(categoriesResponse.status()).toBe(200);
    const categoriesBody = await readJson(categoriesResponse);
    const materialCategory = (categoriesBody?.data || []).find((item: any) => item.name === '材料费');
    expect(materialCategory?.id).toBeTruthy();
    expect(materialCategory?.name).toBe('材料费');

    const departmentsResponse = await page.request.get('/api/departments?pageSize=100', {
      headers: authHeaders,
    });
    expect(departmentsResponse.status()).toBe(200);
    const departmentsBody = await readJson(departmentsResponse);
    const firstDepartment = (departmentsBody?.data || []).find((item: any) => item.name === '第一项目部') || departmentsBody?.data?.[0];
    expect(firstDepartment?.id).toBeTruthy();
    expect(firstDepartment?.name).toBeTruthy();

    const currentDate = new Date().toISOString().slice(0, 10);
    const handler = `财务看板经办-${stamp}`;
    const detail = `真实浏览器财务看板汇总-${stamp}`;
    const amount = 4321.09;

    const createExpenseResponse = await page.request.post('/api/finance/expenses', {
      headers: authHeaders,
      data: {
        source: 'company_finance',
        departmentId: firstDepartment.id,
        handler,
        categoryId: materialCategory.id,
        amount,
        paymentMethod: 'company_direct',
        payer: '财务看板付款方',
        expenseDate: currentDate,
        detail,
      },
    });
    expect(createExpenseResponse.status()).toBe(201);
    const createExpenseBody = await readJson(createExpenseResponse);
    const expenseId = createExpenseBody?.data?.id;
    expect(expenseId).toBeTruthy();

    const approveResponse = await page.request.put(`/api/finance/expenses/${expenseId}/approve`, {
      headers: authHeaders,
    });
    expect(approveResponse.status()).toBe(200);
    const approveBody = await readJson(approveResponse);
    expect(approveBody?.data?.status).toBe('approved');

    const dashboardResponse = await page.request.get('/api/finance/summary/dashboard', {
      headers: authHeaders,
    });
    expect(dashboardResponse.status()).toBe(200);
    const dashboardBody = await readJson(dashboardResponse);
    expect(Number(dashboardBody?.data?.monthExpenseTotal || 0)).toBeGreaterThanOrEqual(amount);
    expect(Number(dashboardBody?.data?.yearExpenseTotal || 0)).toBeGreaterThanOrEqual(amount);

    const month = currentDate.slice(0, 7);
    const trendResponse = await page.request.get('/api/finance/summary/monthly-trend', {
      headers: authHeaders,
      params: { months: 12 },
    });
    expect(trendResponse.status()).toBe(200);
    const trendBody = await readJson(trendResponse);
    const currentMonthTrend = (trendBody?.data || []).find((item: any) => item.month === month);
    expect(Number(currentMonthTrend?.total || 0)).toBeGreaterThanOrEqual(amount);

    const categoryResponse = await page.request.get('/api/finance/summary/category-breakdown', {
      headers: authHeaders,
      params: { startDate: `${month}-01`, endDate: `${month}-31` },
    });
    expect(categoryResponse.status()).toBe(200);
    const categoryBody = await readJson(categoryResponse);
    const categorySummary = (categoryBody?.data || []).find((item: any) => item.categoryId === materialCategory.id);
    expect(Number(categorySummary?.total || 0)).toBeGreaterThanOrEqual(amount);

    const rankingResponse = await page.request.get('/api/finance/summary/department-ranking', {
      headers: authHeaders,
      params: { month },
    });
    expect(rankingResponse.status()).toBe(200);
    const rankingBody = await readJson(rankingResponse);
    const departmentSummary = (rankingBody?.data || []).find((item: any) => item.departmentId === firstDepartment.id);
    expect(Number(departmentSummary?.total || 0)).toBeGreaterThanOrEqual(amount);

    await page.goto('/finance/dashboard');
    await expect(page.getByRole('heading', { name: '财务仪表盘' })).toBeVisible();
    await expect(page.getByTestId('finance-dashboard-month-expense')).toContainText(formatSmokeMoney(Number(dashboardBody.data.monthExpenseTotal)));
    await expect(page.getByTestId('finance-dashboard-year-expense')).toContainText(formatSmokeMoney(Number(dashboardBody.data.yearExpenseTotal)));
    await expect(page.getByTestId('finance-dashboard-monthly-trend')).toContainText('月度支出趋势');
    await expect(page.getByTestId('finance-dashboard-monthly-trend')).toContainText(formatSmokeMoney(Number(currentMonthTrend.total)));
    await expect(page.getByTestId(`finance-dashboard-category-${materialCategory.name}`)).toContainText(formatSmokeMoney(Number(categorySummary.total)));
    await expect(page.getByTestId(`finance-dashboard-category-${materialCategory.name}`)).toContainText('%');
    await expect(page.getByTestId(`finance-dashboard-department-${firstDepartment.name}`)).toContainText(formatSmokeMoney(Number(departmentSummary.total)));
    await expect(page.getByTestId(`finance-dashboard-department-${firstDepartment.name}`)).toContainText(`${departmentSummary.count} 笔`);

    await page.screenshot({
      path: '../docs/smoke-evidence/财务看板真实汇总数据.png',
      fullPage: true,
    });
  });

  test('enterprise user can complete finance invoice receipt pnl import export CRUD', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const invoiceNo = `FP-${stamp}`;
    const editedInvoiceNo = `${invoiceNo}-EDIT`;
    const payerName = `浏览器付款方-${stamp}`;
    const editedPayerName = `${payerName}-已编辑`;
    const transactionNo = `BANK-${stamp}`;
    const importHandler = `浏览器导入经办-${stamp}`;
    const importDetail = `真实浏览器台账导入-${stamp}`;
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();

    await page.goto('/finance/invoices');
    await expect(page.getByRole('heading', { name: '开票记录', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '新增发票' }).click();
    await page.locator('select').filter({ hasText: '请选择合同' }).selectOption({ label: 'XX市政道路改造工程' });
    await page.getByPlaceholder('请输入发票号码').fill(invoiceNo);
    await page.getByPlaceholder('0.00').first().fill('888.88');
    await page.getByPlaceholder('请输入购买方公司名称').fill(`浏览器购买方-${stamp}`);
    await page.getByPlaceholder('请输入备注信息（可选）').fill(`真实浏览器发票-${stamp}`);
    await page.getByRole('button', { name: '保存发票' }).click();
    await expect(page.getByText('发票录入成功')).toBeVisible();
    await expect(page.getByText(invoiceNo)).toBeVisible();

    const invoiceResponse = await page.request.get(`/api/finance/invoices?pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(invoiceResponse.status()).toBe(200);
    const invoiceBody = await readJson(invoiceResponse);
    const createdInvoice = (invoiceBody?.data || []).find((item: any) => item.invoiceNumber === invoiceNo);
    expect(createdInvoice?.id).toBeTruthy();

    await page.goto('/finance/receipts');
    await expect(page.getByRole('heading', { name: '收款记录', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '新增收款' }).click();
    await page.locator('select').filter({ hasText: '请选择合同' }).selectOption({ label: 'XX市政道路改造工程' });
    const invoiceSelect = page.locator('select').filter({ hasText: '不关联发票' });
    await expect(invoiceSelect.locator('option', { hasText: invoiceNo })).toHaveCount(1, { timeout: 10000 });
    const invoiceOptionValue = await invoiceSelect.locator('option', { hasText: invoiceNo }).first().getAttribute('value');
    expect(invoiceOptionValue).toBeTruthy();
    await invoiceSelect.selectOption(invoiceOptionValue!);
    await page.getByPlaceholder('0.00').first().fill('388.88');
    await page.getByPlaceholder('请输入付款方公司或人员名称').fill(payerName);
    await page.getByPlaceholder('请输入收款账户名称或账号').fill('浏览器测试收款账户');
    await page.getByPlaceholder('请输入银行流水号或交易凭证号').fill(transactionNo);
    await page.getByPlaceholder('请输入备注信息（可选）').fill(`真实浏览器收款-${stamp}`);
    await page.getByRole('button', { name: '保存收款' }).click();
    await expect(page.getByText('收款记录录入成功')).toBeVisible();
    await page.getByPlaceholder('付款方/流水号...').fill(transactionNo);
    const receiptRow = page.locator('tr', { hasText: transactionNo });
    await expect(receiptRow).toBeVisible();
    await expect(receiptRow).toContainText(invoiceNo);

    const receiptResponse = await page.request.get(`/api/finance/receipts?keyword=${encodeURIComponent(transactionNo)}&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(receiptResponse.status()).toBe(200);
    const receiptBody = await readJson(receiptResponse);
    const createdReceipt = (receiptBody?.data || []).find((item: any) => item.transactionNo === transactionNo);
    expect(createdReceipt?.id).toBeTruthy();
    expect(createdReceipt?.invoiceNumber).toBe(invoiceNo);

    await receiptRow.locator('button[title="编辑"]').click();
    await expect(page.getByRole('heading', { name: '编辑收款' })).toBeVisible();
    await page.getByPlaceholder('请输入付款方公司或人员名称').fill(editedPayerName);
    await page.getByRole('button', { name: '更新收款' }).click();
    await expect(page.getByText('收款记录更新成功')).toBeVisible();
    await page.getByPlaceholder('付款方/流水号...').fill(editedPayerName);
    const editedReceiptRow = page.locator('tr', { hasText: editedPayerName });
    await expect(editedReceiptRow).toBeVisible();

    await page.goto('/finance/invoices');
    const invoiceRow = page.locator('tr', { hasText: invoiceNo });
    await expect(invoiceRow).toBeVisible();
    await invoiceRow.click();
    await expect(page.getByText('关联收款明细')).toBeVisible();
    await expect(page.getByText(editedPayerName)).toBeVisible();
    await invoiceRow.locator('button[title="编辑"]').click();
    await expect(page.getByRole('heading', { name: '编辑发票' })).toBeVisible();
    await page.getByPlaceholder('请输入发票号码').fill(editedInvoiceNo);
    await page.getByRole('button', { name: '更新发票' }).click();
    await expect(page.getByText('发票更新成功')).toBeVisible();
    await expect(page.getByText(editedInvoiceNo)).toBeVisible();

    const pnlResponse = await page.request.get(`/api/finance/contract/${createdInvoice.contractId}/pnl`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(pnlResponse.status()).toBe(200);
    const pnlBody = await readJson(pnlResponse);
    expect(Number(pnlBody?.data?.invoiceTotal || 0)).toBeGreaterThanOrEqual(888.88);
    expect(Number(pnlBody?.data?.receiptTotal || 0)).toBeGreaterThanOrEqual(388.88);
    const pnlReceiptMoney = `¥${Number(pnlBody.data.receiptTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pnlInvoiceMoney = `¥${Number(pnlBody.data.invoiceTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    await page.goto('/finance/contract-pnl');
    await expect(page.getByRole('heading', { name: '合同盈利分析' })).toBeVisible();
    const pnlRow = page.locator('tr', { hasText: 'XX市政道路改造工程' });
    await expect(pnlRow).toBeVisible();
    await expect(pnlRow).toContainText(pnlReceiptMoney);
    await pnlRow.getByRole('button', { name: '查看详情' }).click();
    await expect(page).toHaveURL(new RegExp(`/finance/contract-pnl/${createdInvoice.contractId}`));
    await expect(page.getByRole('heading', { name: 'XX市政道路改造工程' })).toBeVisible();
    await expect(page.getByText(pnlReceiptMoney).first()).toBeVisible();
    await expect(page.getByText(pnlInvoiceMoney).first()).toBeVisible();

    await page.goto('/finance/import');
    await expect(page.getByRole('heading', { name: '费用导入', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '文件导入' }).click();
    const templateDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载模板' }).click();
    expect((await templateDownload).suggestedFilename()).toBe('费用导入模板.csv');

    const csvPath = path.resolve(process.cwd(), `tests/.tmp-finance-import-${stamp}.csv`);
    fs.writeFileSync(
      csvPath,
      `日期,经办人,费用大类,费用子类,金额,支付方式,支付人,详情\n2026-06-22,${importHandler},材料费,,66.66,公司直付,浏览器导入付款方,${importDetail}\n`,
      'utf8',
    );
    try {
      await page.locator('#csv-file-input').setInputFiles(csvPath);
      await expect(page.getByText(importHandler)).toBeVisible();
      await page.getByRole('button', { name: /确认导入/ }).click();
      await expect(page.getByRole('heading', { name: '导入结果' })).toBeVisible();
      await expect(page.getByText('成功导入')).toBeVisible();
      await page.getByRole('button', { name: '确定' }).click();
    } finally {
      fs.rmSync(csvPath, { force: true });
    }

    await page.goto('/finance/expenses');
    await expect(page.getByRole('heading', { name: '费用列表', exact: true })).toBeVisible();
    await page.getByPlaceholder('经办人/明细...').fill(importDetail);
    await expect(page.locator('tr', { hasText: importHandler })).toBeVisible();

    await page.goto('/finance/import');
    const ledgerDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出费用台账' }).click();
    expect((await ledgerDownloadPromise).suggestedFilename()).toBe('费用台账.xlsx');
    await expect(page.getByText('费用台账已导出')).toBeVisible();
    const summaryDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出财务汇总' }).click();
    expect((await summaryDownloadPromise).suggestedFilename()).toBe('财务汇总.xlsx');
    await expect(page.getByText('财务汇总已导出')).toBeVisible();

    await page.goto('/finance/receipts');
    await page.getByPlaceholder('付款方/流水号...').fill(editedPayerName);
    const rowForDelete = page.locator('tr', { hasText: editedPayerName });
    await expect(rowForDelete).toBeVisible();
    await rowForDelete.locator('button[title="删除"]').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('收款记录已删除')).toBeVisible();

    await page.goto('/finance/invoices');
    const invoiceRowForDelete = page.locator('tr', { hasText: editedInvoiceNo });
    await expect(invoiceRowForDelete).toBeVisible();
    await invoiceRowForDelete.locator('button[title="删除"]').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('发票已删除')).toBeVisible();
    await expect(page.locator('tr', { hasText: editedInvoiceNo })).toHaveCount(0);

    await page.screenshot({
      path: '../docs/smoke-evidence/财务发票收款盈亏导入导出.png',
      fullPage: true,
    });
  });

  test('enterprise user can manage finance categories and recycle bin lifecycle', async ({ page }) => {
    test.setTimeout(120_000);
    await loginEnterprise(page);
    const stamp = Date.now();
    const categoryName = `浏览器费用大类-${stamp}`;
    const categoryNameEdited = `${categoryName}-已编辑`;
    const subCategoryName = `浏览器费用子类-${stamp}`;
    const subCategoryNameEdited = `${subCategoryName}-已编辑`;
    const contractName = `浏览器回收站合同-${stamp}`;
    const contractCode = `RB-${stamp}`;
    const token = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();

    await page.goto('/finance/settings');
    await expect(page.getByRole('heading', { name: '费用类别设置' })).toBeVisible();
    const mainCategoryCard = page.locator('.card').filter({ hasText: '主类别' }).first();
    await mainCategoryCard.getByRole('button', { name: /新增/ }).click();
    await expect(page.getByRole('heading', { name: '新增主类别' })).toBeVisible();
    await page.getByPlaceholder('例如：办公费、差旅费、车辆费用').fill(categoryName);
    await page.getByPlaceholder('数字越小越靠前').fill('7');
    await page.getByRole('button', { name: '创建' }).click();
    await expect(page.getByText('类别创建成功')).toBeVisible();
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.getByTitle(`编辑主类别 ${categoryName}`).click();
    await expect(page.getByRole('heading', { name: '编辑主类别' })).toBeVisible();
    await page.getByPlaceholder('例如：办公费、差旅费、车辆费用').fill(categoryNameEdited);
    await page.getByPlaceholder('数字越小越靠前').fill('8');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('类别更新成功')).toBeVisible();
    await expect(page.getByText(categoryNameEdited)).toBeVisible();

    await page.getByText(categoryNameEdited, { exact: true }).click();
    await expect(page.getByText(`子类别 - ${categoryNameEdited}`)).toBeVisible();
    await page.getByRole('button', { name: '新增子类别', exact: true }).click();
    await expect(page.getByRole('heading', { name: '新增子类别' })).toBeVisible();
    await page.getByPlaceholder('例如：燃油费、过路费、停车费').fill(subCategoryName);
    await page.getByPlaceholder('数字越小越靠前').fill('3');
    await page.getByRole('button', { name: '创建' }).click();
    await expect(page.getByText('子类别创建成功')).toBeVisible();
    await expect(page.getByText(subCategoryName)).toBeVisible();

    await page.getByTitle(`编辑子类别 ${subCategoryName}`).click();
    await expect(page.getByRole('heading', { name: '编辑子类别' })).toBeVisible();
    await page.getByPlaceholder('例如：燃油费、过路费、停车费').fill(subCategoryNameEdited);
    await page.getByPlaceholder('数字越小越靠前').fill('4');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page.getByText('子类别更新成功')).toBeVisible();
    await expect(page.getByText(subCategoryNameEdited)).toBeVisible();

    const categoriesResponse = await page.request.get('/api/finance/categories', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(categoriesResponse.status()).toBe(200);
    const categoriesBody = await readJson(categoriesResponse);
    const createdCategory = (categoriesBody?.data || []).find((item: any) => item.name === categoryNameEdited);
    expect(createdCategory?.id).toBeTruthy();
    expect((createdCategory?.subCategories || []).some((item: any) => item.name === subCategoryNameEdited)).toBe(true);

    await page.getByTitle(`删除子类别 ${subCategoryNameEdited}`).click();
    await expect(page.getByRole('heading', { name: '删除子类别' })).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('子类别已删除')).toBeVisible();
    await expect(page.getByText(subCategoryNameEdited)).toHaveCount(0);

    await page.getByTitle(`删除主类别 ${categoryNameEdited}`).click();
    await expect(page.getByRole('heading', { name: '删除主类别' })).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('类别已删除', { exact: true })).toBeVisible();
    await expect(page.getByText(categoryNameEdited)).toHaveCount(0);

    const categoriesAfterDeleteResponse = await page.request.get('/api/finance/categories', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(categoriesAfterDeleteResponse.status()).toBe(200);
    const categoriesAfterDeleteBody = await readJson(categoriesAfterDeleteResponse);
    expect((categoriesAfterDeleteBody?.data || []).some((item: any) => item.name === categoryNameEdited)).toBe(false);

    await page.goto('/contracts');
    await expect(page.getByRole('heading', { name: '合同管理' })).toBeVisible();
    await page.getByRole('button', { name: /新增承包合同/ }).click();
    await page.getByPlaceholder('请输入合同名称').fill(contractName);
    await page.getByPlaceholder('请输入合同编号').fill(contractCode);
    await page.getByPlaceholder('请输入合同总金额').fill('4321');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expect(page.getByText(contractName)).toBeVisible();
    const contractRow = page.locator('tr', { hasText: contractName });
    await contractRow.getByTitle('删除').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('合同已删除')).toBeVisible();

    await page.goto('/admin/recycle-bin');
    await expect(page.getByRole('heading', { name: '回收站' })).toBeVisible();
    await page.getByRole('button', { name: '合同' }).click();
    await page.getByPlaceholder('搜索名称/编号...').fill(contractName);
    await page.getByRole('button', { name: '搜索' }).click();
    const recycleRow = page.locator('tr', { hasText: contractName });
    await expect(recycleRow).toBeVisible();
    await expect(recycleRow).toContainText(contractCode);
    const recycleKeywordResponse = await page.request.get(`/api/recycle-bin?type=contract&keyword=${encodeURIComponent(contractName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(recycleKeywordResponse.status()).toBe(200);
    const recycleKeywordBody = await readJson(recycleKeywordResponse);
    expect((recycleKeywordBody?.data || []).some((item: any) => item.name === contractName)).toBe(true);
    await recycleRow.getByTitle('恢复').click();
    await expect(page.getByText('成功恢复 1 个项目')).toBeVisible();
    await expect(page.locator('tr', { hasText: contractName })).toHaveCount(0);

    await page.goto('/contracts');
    await page.getByPlaceholder('搜索合同名称或编号...').fill(contractName);
    await page.keyboard.press('Enter');
    const restoredContractRow = page.locator('tr', { hasText: contractName });
    await expect(restoredContractRow).toBeVisible();
    await restoredContractRow.getByTitle('删除').click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('合同已删除')).toBeVisible();

    await page.goto('/admin/recycle-bin');
    await page.getByRole('button', { name: '合同' }).click();
    await page.getByPlaceholder('搜索名称/编号...').fill(contractCode);
    await page.getByRole('button', { name: '搜索' }).click();
    const rowForPermanentDelete = page.locator('tr', { hasText: contractName });
    await expect(rowForPermanentDelete).toBeVisible();
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('永久删除 1 个项目');
      await dialog.accept();
    });
    await rowForPermanentDelete.getByTitle('永久删除').click();
    await expect(page.getByText('永久删除 1 个项目')).toBeVisible();
    await expect(page.locator('tr', { hasText: contractName })).toHaveCount(0);

    const recycleAfterDeleteResponse = await page.request.get(`/api/recycle-bin?type=contract&search=${encodeURIComponent(contractName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(recycleAfterDeleteResponse.status()).toBe(200);
    const recycleAfterDeleteBody = await readJson(recycleAfterDeleteResponse);
    expect((recycleAfterDeleteBody?.data || []).some((item: any) => item.name === contractName)).toBe(false);

    await page.screenshot({
      path: '../docs/smoke-evidence/财务类别回收站CRUD.png',
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

    const portalHost = `portal-${stamp}.localhost`;
    await configureTenantPortal(page, developerToken, tenant.tenantId, stamp, portalHost);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`http://${portalHost}:5173/login`);
    await expect(page).toHaveURL(new RegExp(`http://${portalHost}:5173/login`));
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
