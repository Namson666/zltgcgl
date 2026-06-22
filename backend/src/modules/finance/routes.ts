// ============================================
// 财务管理（Finance）路由模块 — HTTP 薄层
// ============================================
// 所有业务逻辑已抽取到 service.ts
// routes.ts 只负责 HTTP 请求/响应

import { Router, Response } from 'express';
import { authenticate, requireUser } from '../../common/middleware/auth';
import { requirePermission } from '../../common/middleware/permission';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';
import * as finance from './service';

// ============================================
// 初始化
// ============================================

const router = Router();

// ============================================
// 辅助函数
// ============================================

function getTenantId(req: AuthenticatedRequest): string {
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw { status: 400, code: 'NO_TENANT', message: '当前用户未关联企业' };
  return tenantId;
}

function getEffectiveUserId(req: AuthenticatedRequest): string | undefined {
  if (req.user?.type === 'developer') return undefined;
  return req.user?.id;
}

function wrapHandler(handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      if (err.status && err.code) {
        res.status(err.status).json({ success: false, error: err.code, message: err.message } as unknown as ApiResponse);
      } else {
        console.error('[Finance Error]', err);
        res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message || '服务器内部错误' } as unknown as ApiResponse);
      }
    }
  };
}

function asPaginated(data: any, total: number, page: number, pageSize: number) {
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  } as unknown as PaginatedResponse<any>;
}

function asApi(data: any) {
  return { success: true, data } as unknown as ApiResponse;
}

// ============================================
// 一、费用大类管理（/categories）
// ============================================

const categoryRouter = Router();

// 获取费用大类列表（含子类）
categoryRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const categories = await finance.listCategories(tenantId);
  res.json(asApi(categories));
}));

// 创建费用大类
categoryRouter.post('/', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { name, sortOrder } = req.body;
  if (!name || !name.trim()) {
    throw { status: 400, code: 'INVALID_NAME', message: '分类名称不能为空' };
  }
  const category = await finance.createCategory(tenantId, { name: name.trim(), sortOrder });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `创建费用大类「${category.name}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(asApi(category));
}));

// 更新费用大类
categoryRouter.put('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { name, sortOrder, isActive } = req.body;
  const category = await finance.updateCategory(req.params.id, { name, sortOrder, isActive });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `更新费用大类「${category.name}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(category));
}));

// 删除费用大类（软删除）
categoryRouter.delete('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const category = await finance.deleteCategory(req.params.id);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'DELETE',
    module: '财务管理',
    description: `删除费用大类「${category.name}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(null));
}));

// 获取某大类下的子类列表
categoryRouter.get('/:id/sub', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const subCategories = await finance.listSubCategories(tenantId, req.params.id);
  res.json(asApi(subCategories));
}));

// ============================================
// 二、费用子类管理（/sub-categories）
// ============================================

const subCategoryRouter = Router();

// 创建费用子类
subCategoryRouter.post('/', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { categoryId, name, sortOrder } = req.body;
  if (!categoryId) {
    throw { status: 400, code: 'MISSING_CATEGORY_ID', message: '请指定所属大类' };
  }
  if (!name || !name.trim()) {
    throw { status: 400, code: 'INVALID_NAME', message: '子类名称不能为空' };
  }
  const subCategory = await finance.createSubCategory(tenantId, categoryId, { name: name.trim(), sortOrder });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `创建费用子类「${subCategory.name}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(asApi(subCategory));
}));

// 更新费用子类
subCategoryRouter.put('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { name, sortOrder, isActive } = req.body;
  const subCategory = await finance.updateSubCategory(req.params.id, { name, sortOrder, isActive });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `更新费用子类「${subCategory.name}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(subCategory));
}));

// 删除费用子类（软删除）
subCategoryRouter.delete('/:id', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const subCategory = await finance.deleteSubCategory(req.params.id);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'DELETE',
    module: '财务管理',
    description: `删除费用子类「${subCategory.name}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(null));
}));

// ============================================
// 三、费用记录管理（/expenses）
// ============================================

const expenseRouter = Router();

// 获取费用列表（分页 + 多条件筛选）
expenseRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const {
    contractId, departmentId,
    contractIds, departmentIds,
    categoryId, subCategoryId,
    paymentMethod, status,
    startDate, endDate, keyword,
    page, pageSize,
  } = req.query as any;

  const result = await finance.listExpenses({
    tenantId,
    contractId: contractId as string | undefined,
    departmentId: departmentId as string | undefined,
    contractIds: contractIds as string | undefined,
    departmentIds: departmentIds as string | undefined,
    categoryId: categoryId as string | undefined,
    subCategoryId: subCategoryId as string | undefined,
    paymentMethod: paymentMethod as string | undefined,
    status: status as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
    keyword: keyword as string | undefined,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
  });

  res.json(asPaginated(result.items, result.total, result.page, result.pageSize));
}));

// 获取单条费用详情
expenseRouter.get('/:id', wrapHandler(async (req, res) => {
  const expense = await finance.getExpenseById(req.params.id);
  if (!expense) {
    throw { status: 404, code: 'EXPENSE_NOT_FOUND', message: '费用记录不存在' };
  }
  res.json(asApi(expense));
}));

// 创建费用记录
expenseRouter.post('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const enteredBy = req.user?.id ?? '';

  const expense = await finance.createExpense({
    tenantId,
    source: req.body.source || 'project_department',
    enteredBy,
    contractId: req.body.contractId,
    departmentId: req.body.departmentId,
    handler: req.body.handler,
    categoryId: req.body.categoryId,
    subCategoryId: req.body.subCategoryId,
    amount: req.body.amount,
    paymentMethod: req.body.paymentMethod,
    pettyCashAccountId: req.body.pettyCashAccountId,
    payer: req.body.payer,
    expenseDate: req.body.expenseDate,
    detail: req.body.detail,
    vehiclePlate: req.body.vehiclePlate,
    receiptPath: req.body.receiptPath,
    remark: req.body.remark,
  });

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `登记费用：${expense.handler} - ${expense.category?.name ?? ''} - ¥${expense.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(asApi(expense));
}));

// 更新费用记录
expenseRouter.put('/:id', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const expense = await finance.updateExpense(req.params.id, {
    contractId: req.body.contractId,
    departmentId: req.body.departmentId,
    handler: req.body.handler,
    categoryId: req.body.categoryId,
    subCategoryId: req.body.subCategoryId,
    amount: req.body.amount,
    paymentMethod: req.body.paymentMethod,
    pettyCashAccountId: req.body.pettyCashAccountId,
    payer: req.body.payer,
    expenseDate: req.body.expenseDate,
    detail: req.body.detail,
    vehiclePlate: req.body.vehiclePlate,
    receiptPath: req.body.receiptPath,
    remark: req.body.remark,
  });

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `修改费用记录：${expense.handler} - ¥${expense.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(asApi(expense));
}));

// 删除费用记录
expenseRouter.delete('/:id', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  await finance.deleteExpense(req.params.id);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'DELETE',
    module: '财务管理',
    description: `删除费用记录 ${req.params.id}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(null));
}));

// 审核通过
expenseRouter.put('/:id/approve', requirePermission('canFinanceApprove'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = getEffectiveUserId(req) ?? 'system';
  const expense = await finance.approveExpense(req.params.id, userId);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `审核通过费用：${expense.handler} - ¥${expense.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(expense));
}));

// 审核驳回
expenseRouter.put('/:id/reject', requirePermission('canFinanceApprove'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = getEffectiveUserId(req) ?? 'system';
  const expense = await finance.rejectExpense(req.params.id, userId);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `驳回费用：${expense.handler} - ¥${expense.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(expense));
}));

// ============================================
// 四、汇总/看板（/summary）
// ============================================

const summaryRouter = Router();

// 刷新月度汇总
summaryRouter.post('/refresh', requirePermission('canManageSystem'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const count = await finance.refreshMonthlySummary(tenantId);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `刷新月度汇总，生成 ${count} 条记录`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi({ updatedCount: count }));
}));

// 总额统计
summaryRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate } = req.query as any;
  const result = await finance.getSummaryTotal(tenantId, startDate, endDate);
  res.json(asApi(result));
}));

// 按月度趋势
summaryRouter.get('/monthly', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { months } = req.query as any;
  const result = await finance.getSummaryByMonth(tenantId, months ? parseInt(months as string) : 12);
  res.json(asApi(result));
}));

// 按分类汇总
summaryRouter.get('/by-category', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate } = req.query as any;
  const result = await finance.getSummaryByCategory(tenantId, startDate, endDate);
  res.json(asApi(result));
}));

// 备用金账户余额总览
summaryRouter.get('/balance', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, departmentId } = req.query as any;
  const accounts = await finance.listPettyCashAccountsWithBalance({
    tenantId,
    contractId: contractId as string | undefined,
    departmentId: departmentId as string | undefined,
  });
  res.json(asApi(accounts));
}));

// GET /dashboard - comprehensive dashboard data
summaryRouter.get('/dashboard', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await finance.getDashboardSummary(tenantId);
  res.json(asApi(data));
}));

// GET /monthly-trend - monthly trend for last N months
summaryRouter.get('/monthly-trend', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const months = parseInt(req.query.months as string) || 12;
  const data = await finance.getMonthlyTrend(tenantId, months);
  res.json(asApi(data));
}));

// GET /category-breakdown - category breakdown
summaryRouter.get('/category-breakdown', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const data = await finance.getCategoryBreakdown(tenantId, startDate, endDate);
  res.json(asApi(data));
}));

// GET /department-ranking - department expense ranking
summaryRouter.get('/department-ranking', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const month = req.query.month as string;
  const data = await finance.getDepartmentRanking(tenantId, month);
  res.json(asApi(data));
}));

// ============================================
// 五、备用金管理（/petty-cash）
// ============================================

const pettyCashRouter = Router();

// --- 备用金账户 ---

// 获取账户列表（含余额）
pettyCashRouter.get('/accounts', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, departmentId } = req.query as any;
  const accounts = await finance.listPettyCashAccountsWithBalance({
    tenantId,
    contractId: contractId as string | undefined,
    departmentId: departmentId as string | undefined,
  });
  res.json(asApi(accounts));
}));

// 创建备用金账户
pettyCashRouter.post('/accounts', requirePermission('canFinancePettyCash'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, departmentId, holderName, holderIdCard, initialAdvance } = req.body;
  if (!holderName || !holderName.trim()) {
    throw { status: 400, code: 'INVALID_HOLDER_NAME', message: '持卡人姓名不能为空' };
  }
  const account = await finance.createPettyCashAccount({
    tenantId,
    contractId,
    departmentId,
    holderName: holderName.trim(),
    holderIdCard,
    initialAdvance,
  });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `创建备用金账户「${account.holderName}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(asApi(account));
}));

// 更新备用金账户
pettyCashRouter.put('/accounts/:id', requirePermission('canFinancePettyCash'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { holderName, holderIdCard, isActive, contractId, departmentId } = req.body;
  const account = await finance.updatePettyCashAccount(req.params.id, {
    holderName,
    holderIdCard,
    isActive,
    contractId,
    departmentId,
  });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `更新备用金账户「${account.holderName}」`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(account));
}));

// 获取单个账户详情
pettyCashRouter.get('/accounts/:id', wrapHandler(async (req, res) => {
  const account = await finance.getPettyCashAccount(req.params.id);
  if (!account) {
    throw { status: 404, code: 'ACCOUNT_NOT_FOUND', message: '备用金账户不存在' };
  }
  res.json(asApi(account));
}));

// 获取账户余额
pettyCashRouter.get('/accounts/:id/balance', wrapHandler(async (req, res) => {
  const balance = await finance.getPettyCashBalance(req.params.id);
  res.json(asApi(balance));
}));

// 获取账户下的费用列表
pettyCashRouter.get('/accounts/:id/expenses', wrapHandler(async (req, res) => {
  const { page, pageSize } = req.query as any;
  const result = await finance.listPettyCashExpenses(req.params.id, {
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
  });
  res.json(asPaginated(result.items, result.total, result.page, result.pageSize));
}));

// --- 备用金预支记录 ---

// 创建预支记录
pettyCashRouter.post('/advances', requirePermission('canFinancePettyCash'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { accountId, amount, advanceDate, issuedBy, remark } = req.body;
  if (!accountId) {
    throw { status: 400, code: 'MISSING_ACCOUNT_ID', message: '请指定备用金账户' };
  }
  if (!amount || amount <= 0) {
    throw { status: 400, code: 'INVALID_AMOUNT', message: '预支金额必须大于0' };
  }
  if (!advanceDate) {
    throw { status: 400, code: 'MISSING_DATE', message: '请指定预支日期' };
  }
  const advance = await finance.createPettyCashAdvance({
    tenantId,
    accountId,
    amount: parseFloat(amount),
    advanceDate,
    issuedBy,
    remark,
  });
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `备用金预支 ¥${advance.amount.toFixed(2)} → 账户 ${accountId}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(asApi(advance));
}));

// 获取预支记录列表（支持 accountId 筛选）
pettyCashRouter.get('/advances', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { accountId, page, pageSize } = req.query as any;
  const result = await finance.listPettyCashAdvances({
    tenantId,
    accountId: accountId as string | undefined,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 50,
  });
  res.json(asPaginated(result.items, result.total, result.page, result.pageSize));
}));

// ============================================
// 六、发票管理（/invoices）
// ============================================

const invoiceRouter = Router();

// 获取发票列表（分页 + 多条件筛选）
invoiceRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, status, startDate, endDate, page, pageSize } = req.query as any;

  const result = await finance.listInvoices({
    tenantId,
    contractId: contractId as string | undefined,
    status: status as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
  });

  res.json(asPaginated(result.items, result.total, result.page, result.pageSize));
}));

// 获取单张发票详情
invoiceRouter.get('/:id', wrapHandler(async (req, res) => {
  const invoice = await finance.getInvoiceDetail(req.params.id);
  res.json(asApi(invoice));
}));

// 获取某张发票下的收款记录
invoiceRouter.get('/:id/receipts', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { page, pageSize } = req.query as any;

  const result = await finance.listReceipts({
    tenantId,
    invoiceId: req.params.id,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
  });

  res.json(asPaginated(result.items, result.total, result.page, result.pageSize));
}));

// 创建发票
invoiceRouter.post('/', requirePermission('canFinanceInvoice'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const invoice = await finance.createInvoice({
    tenantId,
    contractId: req.body.contractId,
    invoiceNo: req.body.invoiceNo,
    invoiceType: req.body.invoiceType,
    invoiceDate: req.body.invoiceDate,
    amount: req.body.amount,
    taxRate: req.body.taxRate,
    taxAmount: req.body.taxAmount,
    buyerName: req.body.buyerName,
    description: req.body.description,
    imagePath: req.body.imagePath,
  });

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `开具发票：${invoice.invoiceNo} - ¥${invoice.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(asApi(invoice));
}));

// 更新发票
invoiceRouter.put('/:id', requirePermission('canFinanceInvoice'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const invoice = await finance.updateInvoice(req.params.id, {
    contractId: req.body.contractId,
    invoiceNo: req.body.invoiceNo,
    invoiceType: req.body.invoiceType,
    invoiceDate: req.body.invoiceDate,
    amount: req.body.amount,
    taxRate: req.body.taxRate,
    taxAmount: req.body.taxAmount,
    buyerName: req.body.buyerName,
    description: req.body.description,
    imagePath: req.body.imagePath,
  });

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `修改发票：${invoice.invoiceNo} - ¥${invoice.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(asApi(invoice));
}));

// 删除发票
invoiceRouter.delete('/:id', requirePermission('canFinanceInvoice'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  await finance.deleteInvoice(req.params.id);

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'DELETE',
    module: '财务管理',
    description: `删除发票 ${req.params.id}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(asApi(null));
}));

// ============================================
// 七、收款管理（/receipts）
// ============================================

const receiptRouter = Router();

// 获取收款记录列表（分页 + 多条件筛选）
receiptRouter.get('/', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { contractId, invoiceId, startDate, endDate, page, pageSize } = req.query as any;

  const result = await finance.listReceipts({
    tenantId,
    contractId: contractId as string | undefined,
    invoiceId: invoiceId as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
  });

  res.json(asPaginated(result.items, result.total, result.page, result.pageSize));
}));

// 获取收款汇总（按合同维度）
receiptRouter.get('/summary', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const summary = await finance.getReceiptsSummary(tenantId);
  res.json(asApi(summary));
}));

// 获取逾期未收款项
receiptRouter.get('/overdue', wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const overdue = await finance.getOverdueReceipts(tenantId);
  res.json(asApi(overdue));
}));

// 创建收款记录
receiptRouter.post('/', requirePermission('canFinanceReceipt'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const enteredBy = req.user?.id ?? '';

  const receipt = await finance.createReceipt({
    tenantId,
    contractId: req.body.contractId,
    invoiceId: req.body.invoiceId,
    amount: req.body.amount,
    receiptDate: req.body.receiptDate,
    paymentMethod: req.body.paymentMethod,
    payerName: req.body.payerName,
    bankAccount: req.body.bankAccount,
    transactionNo: req.body.transactionNo,
    enteredBy,
    remark: req.body.remark,
  });

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'CREATE',
    module: '财务管理',
    description: `登记收款：¥${receipt.amount.toFixed(2)} ← ${receipt.payerName || '未知'}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(asApi(receipt));
}));

// 更新收款记录
receiptRouter.put('/:id', requirePermission('canFinanceReceipt'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const receipt = await finance.updateReceipt(req.params.id, {
    contractId: req.body.contractId,
    invoiceId: req.body.invoiceId,
    amount: req.body.amount,
    receiptDate: req.body.receiptDate,
    paymentMethod: req.body.paymentMethod,
    payerName: req.body.payerName,
    bankAccount: req.body.bankAccount,
    transactionNo: req.body.transactionNo,
    remark: req.body.remark,
  });

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'UPDATE',
    module: '财务管理',
    description: `修改收款记录：¥${receipt.amount.toFixed(2)}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(asApi(receipt));
}));

// 删除收款记录
receiptRouter.delete('/:id', requirePermission('canFinanceReceipt'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  await finance.deleteReceipt(req.params.id);

  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'DELETE',
    module: '财务管理',
    description: `删除收款记录 ${req.params.id}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(asApi(null));
}));

// ============================================
// 八、导入导出（/import, /export, /export-summary）
// ============================================

// POST /import - import expenses from JSON (frontend parses Excel first)
router.post('/import', authenticate, requireUser, requirePermission('canFinanceView'), wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const userId = getEffectiveUserId(req) ?? 'system';
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    throw { status: 400, code: 'INVALID_IMPORT_DATA', message: '请提供导入数据' };
  }
  const result = await finance.importExpenses(tenantId, rows, userId);
  await createLog({
    tenantId,
    userId: getEffectiveUserId(req),
    action: 'IMPORT',
    module: '财务管理',
    description: `财务导入: 成功${result.successes.length}条, 失败${result.errors.length}条`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json(asApi(result));
}));

// GET /export - export expenses
router.get('/export', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await finance.exportExpensesData(tenantId, req.query as any);
  res.json(asApi(data));
}));

// GET /export-summary - export summary
router.get('/export-summary', authenticate, requireUser, wrapHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const [categories, trend] = await Promise.all([
    finance.getCategoryBreakdown(tenantId),
    finance.getMonthlyTrend(tenantId, 12),
  ]);
  res.json(asApi({ categories, monthlyTrend: trend }));
}));

// ============================================
// 九、合同损益分析（/contract/:contractId/pnl, /contracts/pnl）
// ============================================

// GET /contract/:contractId/pnl - Single contract P&L
router.get('/contract/:contractId/pnl', authenticate, requireUser, wrapHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = getTenantId(req);
  const { contractId } = req.params;
  const data = await finance.getContractPnl(contractId, tenantId);
  res.json(asApi(data));
}));

// GET /contracts/pnl - All contracts P&L list
router.get('/contracts/pnl', authenticate, requireUser, wrapHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = getTenantId(req);
  const data = await finance.listContractsPnl(tenantId);
  res.json(asApi(data));
}));

// ============================================
// 注册子路由
// ============================================

router.use('/categories', authenticate, requireUser, categoryRouter);
router.use('/sub-categories', authenticate, requireUser, subCategoryRouter);
router.use('/expenses', authenticate, requireUser, expenseRouter);
router.use('/summary', authenticate, requireUser, summaryRouter);
router.use('/petty-cash', authenticate, requireUser, pettyCashRouter);
router.use('/invoices', authenticate, requireUser, invoiceRouter);
router.use('/receipts', authenticate, requireUser, receiptRouter);

export default router;
