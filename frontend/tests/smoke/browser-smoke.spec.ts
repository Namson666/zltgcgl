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
  ['库存预警', '/wms/alerts'],
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
});
