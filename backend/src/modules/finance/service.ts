// ============================================
// 财务管理（Finance）- 业务逻辑层
// ============================================
// 所有财务相关业务逻辑集中管理
// routes.ts 只负责 HTTP 请求/响应

import { prisma } from '../../common/utils/prisma';

// ============================================
// 类型定义
// ============================================

export interface FinanceListParams {
  tenantId: string;
  contractId?: string;
  departmentId?: string;
  contractIds?: string;   // comma-separated
  departmentIds?: string; // comma-separated
  categoryId?: string;
  subCategoryId?: string;
  paymentMethod?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateExpenseData {
  tenantId: string;
  source: string;               // 'project_department' | 'company_finance'
  enteredBy: string;
  contractId?: string;
  departmentId?: string;
  handler: string;
  categoryId: string;
  subCategoryId?: string;
  amount: number;
  paymentMethod: string;        // 'petty_cash' | 'company_direct'
  pettyCashAccountId?: string;
  payer: string;
  expenseDate: string;
  detail?: string;
  vehiclePlate?: string;
  receiptPath?: string;
  remark?: string;
}

export interface ImportExpenseRow {
  handler: string;
  expenseDate: string;
  categoryName: string;
  subCategoryName?: string;
  amount: number;
  paymentMethod: string;
  payer: string;
  detail?: string;
  contractName?: string;
  departmentName?: string;
}

// ============================================
// 费用大类 CRUD
// ============================================

export async function listCategories(tenantId: string) {
  return prisma.finCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      subCategories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export async function createCategory(tenantId: string, data: { name: string; sortOrder?: number }) {
  return prisma.finCategory.create({
    data: {
      tenantId,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateCategory(id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
  return prisma.finCategory.update({
    where: { id },
    data,
  });
}

export async function deleteCategory(id: string) {
  // Soft delete: set isActive to false
  return prisma.finCategory.update({
    where: { id },
    data: { isActive: false },
  });
}

// ============================================
// 费用子类 CRUD
// ============================================

export async function listSubCategories(tenantId: string, categoryId: string) {
  return prisma.finSubCategory.findMany({
    where: { tenantId, categoryId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createSubCategory(tenantId: string, categoryId: string, data: { name: string; sortOrder?: number }) {
  return prisma.finSubCategory.create({
    data: {
      tenantId,
      categoryId,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateSubCategory(id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
  return prisma.finSubCategory.update({
    where: { id },
    data,
  });
}

export async function deleteSubCategory(id: string) {
  // Soft delete: set isActive to false
  return prisma.finSubCategory.update({
    where: { id },
    data: { isActive: false },
  });
}

// ============================================
// 费用记录 CRUD
// ============================================

export async function listExpenses(params: FinanceListParams) {
  const {
    tenantId, contractId, departmentId,
    contractIds, departmentIds,
    categoryId, subCategoryId,
    paymentMethod, status,
    startDate, endDate, keyword,
    page = 1, pageSize = 20,
  } = params;

  const where: any = { tenantId }

  // 单合同/项目部过滤
  if (contractId) where.contractId = contractId;
  if (departmentId) where.departmentId = departmentId;

  // 多合同/多项目部过滤（逗号分隔）
  if (contractIds) {
    const ids = contractIds.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) where.contractId = { in: ids };
  }
  if (departmentIds) {
    const ids = departmentIds.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) where.departmentId = { in: ids };
  }

  // 分类过滤
  if (categoryId) where.categoryId = categoryId;
  if (subCategoryId) where.subCategoryId = subCategoryId;

  // 支付方式过滤
  if (paymentMethod) where.paymentMethod = paymentMethod;

  // 状态过滤
  if (status) where.status = status;

  // 日期范围过滤
  if (startDate || endDate) {
    where.expenseDate = {};
    if (startDate) where.expenseDate.gte = startDate;
    if (endDate) where.expenseDate.lte = endDate;
  }

  // 关键词搜索
  if (keyword) {
    where.OR = [
      { handler: { contains: keyword } },
      { detail: { contains: keyword } },
      { payer: { contains: keyword } },
      { vehiclePlate: { contains: keyword } },
      { remark: { contains: keyword } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.finExpense.findMany({
      where,
      include: {
        category: true,
        subCategory: true,
        pettyCashAccount: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.finExpense.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getExpenseById(id: string) {
  return prisma.finExpense.findUnique({
    where: { id },
    include: {
      category: true,
      subCategory: true,
      pettyCashAccount: true,
    },
  });
}

export async function createExpense(data: CreateExpenseData) {
  // 校验：备用金支付必须选择账户
  if (data.paymentMethod === 'petty_cash' && !data.pettyCashAccountId) {
    throw { status: 400, code: 'PETTY_CASH_ACCOUNT_REQUIRED', message: '备用金支付必须选择备用金账户' };
  }

  return prisma.finExpense.create({
    data: {
      tenantId: data.tenantId,
      source: data.source,
      enteredBy: data.enteredBy,
      contractId: data.contractId ?? null,
      departmentId: data.departmentId ?? null,
      handler: data.handler,
      categoryId: data.categoryId,
      subCategoryId: data.subCategoryId ?? null,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      pettyCashAccountId: data.pettyCashAccountId ?? null,
      payer: data.payer,
      expenseDate: data.expenseDate,
      detail: data.detail ?? null,
      vehiclePlate: data.vehiclePlate ?? null,
      receiptPath: data.receiptPath ?? null,
      remark: data.remark ?? null,
    },
    include: {
      category: true,
      subCategory: true,
      pettyCashAccount: true,
    },
  });
}

export async function updateExpense(id: string, data: Partial<CreateExpenseData>) {
  const expense = await prisma.finExpense.findUnique({ where: { id } });
  if (!expense) {
    throw { status: 404, code: 'EXPENSE_NOT_FOUND', message: '费用记录不存在' };
  }
  if (expense.status === 'approved') {
    throw { status: 400, code: 'EXPENSE_ALREADY_APPROVED', message: '已审核的费用不能修改' };
  }

  const updateData: any = {};
  if (data.contractId !== undefined) updateData.contractId = data.contractId ?? null;
  if (data.departmentId !== undefined) updateData.departmentId = data.departmentId ?? null;
  if (data.handler !== undefined) updateData.handler = data.handler;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.subCategoryId !== undefined) updateData.subCategoryId = data.subCategoryId ?? null;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.paymentMethod !== undefined) {
    updateData.paymentMethod = data.paymentMethod;
    if (data.paymentMethod === 'petty_cash' && !data.pettyCashAccountId && !expense.pettyCashAccountId) {
      throw { status: 400, code: 'PETTY_CASH_ACCOUNT_REQUIRED', message: '备用金支付必须选择备用金账户' };
    }
  }
  if (data.pettyCashAccountId !== undefined) updateData.pettyCashAccountId = data.pettyCashAccountId ?? null;
  if (data.payer !== undefined) updateData.payer = data.payer;
  if (data.expenseDate !== undefined) updateData.expenseDate = data.expenseDate;
  if (data.detail !== undefined) updateData.detail = data.detail ?? null;
  if (data.vehiclePlate !== undefined) updateData.vehiclePlate = data.vehiclePlate ?? null;
  if (data.receiptPath !== undefined) updateData.receiptPath = data.receiptPath ?? null;
  if (data.remark !== undefined) updateData.remark = data.remark ?? null;

  return prisma.finExpense.update({
    where: { id },
    data: updateData,
    include: {
      category: true,
      subCategory: true,
      pettyCashAccount: true,
    },
  });
}

export async function deleteExpense(id: string) {
  const expense = await prisma.finExpense.findUnique({ where: { id } });
  if (!expense) {
    throw { status: 404, code: 'EXPENSE_NOT_FOUND', message: '费用记录不存在' };
  }
  if (expense.status === 'approved') {
    throw { status: 400, code: 'EXPENSE_ALREADY_APPROVED', message: '已审核的费用不能删除' };
  }
  return prisma.finExpense.delete({ where: { id } });
}

export async function approveExpense(id: string, userId: string) {
  const expense = await prisma.finExpense.findUnique({ where: { id } });
  if (!expense) {
    throw { status: 404, code: 'EXPENSE_NOT_FOUND', message: '费用记录不存在' };
  }
  if (expense.status === 'approved') {
    throw { status: 400, code: 'EXPENSE_ALREADY_APPROVED', message: '该费用已审核通过' };
  }

  return prisma.finExpense.update({
    where: { id },
    data: {
      status: 'approved',
      reviewedBy: userId,
    },
    include: {
      category: true,
      subCategory: true,
      pettyCashAccount: true,
    },
  });
}

export async function rejectExpense(id: string, userId: string) {
  const expense = await prisma.finExpense.findUnique({ where: { id } });
  if (!expense) {
    throw { status: 404, code: 'EXPENSE_NOT_FOUND', message: '费用记录不存在' };
  }
  if (expense.status === 'approved') {
    throw { status: 400, code: 'EXPENSE_ALREADY_APPROVED', message: '已审核的费用不能驳回' };
  }

  return prisma.finExpense.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedBy: userId,
    },
    include: {
      category: true,
      subCategory: true,
      pettyCashAccount: true,
    },
  });
}

// ============================================
// 月度汇总快照
// ============================================

export async function refreshMonthlySummary(tenantId: string): Promise<number> {
  // 按期汇总已审核的费用记录
  const expenses = await prisma.finExpense.findMany({
    where: { tenantId, status: 'approved' },
    select: {
      contractId: true,
      departmentId: true,
      categoryId: true,
      expenseDate: true,
      amount: true,
    },
  });

  const summaryMap = new Map<string, { total: number; count: number }>();

  for (const e of expenses) {
    const parts = e.expenseDate.split('-');
    const year = parts[0];
    const month = parts[1];
    const key = `${e.contractId || '_'}|${e.departmentId || '_'}|${year}|${month}|${e.categoryId}`;

    const existing = summaryMap.get(key) || { total: 0, count: 0 };
    existing.total += e.amount;
    existing.count += 1;
    summaryMap.set(key, existing);
  }

  for (const [key, val] of summaryMap) {
    const [contractId, departmentId, year, month, categoryId] = key.split('|');
    const cId = contractId === '_' ? undefined : contractId;
    const dId = departmentId === '_' ? undefined : departmentId;
    const y = parseInt(year);
    const m = parseInt(month);

    const existing = await prisma.finMonthlySummary.findFirst({
      where: { tenantId, contractId: cId ?? null, departmentId: dId ?? null, year: y, month: m, categoryId },
    });

    if (existing) {
      await prisma.finMonthlySummary.update({
        where: { id: existing.id },
        data: { totalAmount: val.total, expenseCount: val.count },
      });
    } else {
      await prisma.finMonthlySummary.create({
        data: { tenantId, contractId: cId, departmentId: dId, year: y, month: m, categoryId, totalAmount: val.total, expenseCount: val.count },
      });
    }
  }

  return summaryMap.size;
}

// ============================================
// 汇总/看板查询
// ============================================

export async function getSummaryByMonth(tenantId: string, months: number = 12) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startDateStr = startDate.toISOString().slice(0, 7) + '-01';

  const rows = await prisma.finExpense.groupBy({
    by: ['expenseDate'],
    where: {
      tenantId,
      status: 'approved',
      expenseDate: { gte: startDateStr },
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { expenseDate: 'asc' },
  });

  // Group by year-month
  const monthlyMap = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const [year, month] = row.expenseDate.split('-');
    const key = `${year}-${month}`;
    const existing = monthlyMap.get(key) || { total: 0, count: 0 };
    existing.total += row._sum.amount ?? 0;
    existing.count += row._count.id;
    monthlyMap.set(key, existing);
  }

  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, totalAmount: data.total, expenseCount: data.count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getSummaryByCategory(tenantId: string, startDate?: string, endDate?: string) {
  const where: any = { tenantId, status: 'approved' };

  if (startDate || endDate) {
    where.expenseDate = {};
    if (startDate) where.expenseDate.gte = startDate;
    if (endDate) where.expenseDate.lte = endDate;
  }

  const rows = await prisma.finExpense.groupBy({
    by: ['categoryId'],
    where,
    _sum: { amount: true },
    _count: { id: true },
  });

  // Fetch category names
  const categoryIds = rows.map(r => r.categoryId);
  const categories = await prisma.finCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  return rows.map(row => ({
    categoryId: row.categoryId,
    categoryName: categoryMap.get(row.categoryId) ?? '未知分类',
    totalAmount: row._sum.amount ?? 0,
    expenseCount: row._count.id,
  }));
}

export async function getSummaryTotal(tenantId: string, startDate?: string, endDate?: string) {
  const where: any = { tenantId, status: 'approved' };

  if (startDate || endDate) {
    where.expenseDate = {};
    if (startDate) where.expenseDate.gte = startDate;
    if (endDate) where.expenseDate.lte = endDate;
  }

  const result = await prisma.finExpense.aggregate({
    where,
    _sum: { amount: true },
    _count: { id: true },
  });

  return {
    totalAmount: result._sum.amount ?? 0,
    totalCount: result._count.id,
  };
}

// ============================================
// 备用金账户查询（工具接口）
// ============================================

export async function listPettyCashAccounts(tenantId: string, contractId?: string, departmentId?: string) {
  const where: any = { tenantId, isActive: true };
  if (contractId) where.contractId = contractId;
  if (departmentId) where.departmentId = departmentId;

  return prisma.finPettyCashAccount.findMany({
    where,
    orderBy: { holderName: 'asc' },
  });
}

// ============================================
// 备用金账户 CRUD
// ============================================

export interface CreatePettyCashAccountData {
  tenantId: string;
  contractId?: string;
  departmentId?: string;
  holderName: string;
  holderIdCard?: string;
  initialAdvance?: number;
}

export async function createPettyCashAccount(data: CreatePettyCashAccountData) {
  const account = await prisma.finPettyCashAccount.create({
    data: {
      tenantId: data.tenantId,
      contractId: data.contractId,
      departmentId: data.departmentId,
      holderName: data.holderName,
      holderIdCard: data.holderIdCard,
      initialAdvance: data.initialAdvance ?? 0,
    },
  });

  // If there's an initial advance, create an advance record
  if (data.initialAdvance && data.initialAdvance > 0) {
    await prisma.finPettyCashAdvance.create({
      data: {
        tenantId: data.tenantId,
        accountId: account.id,
        amount: data.initialAdvance,
        advanceDate: new Date().toISOString().slice(0, 10),
        issuedBy: '系统初始化',
        remark: '账户创建-初始备用金',
      },
    });
  }

  return account;
}

export async function updatePettyCashAccount(id: string, data: { holderName?: string; holderIdCard?: string; isActive?: boolean; contractId?: string; departmentId?: string }) {
  return prisma.finPettyCashAccount.update({ where: { id }, data });
}

export async function getPettyCashAccount(id: string) {
  return prisma.finPettyCashAccount.findUnique({ where: { id } });
}

export async function getPettyCashBalance(accountId: string) {
  // Balance = SUM(advances) - SUM(expenses paid via this account)
  const [advancesTotal, expensesTotal] = await Promise.all([
    prisma.finPettyCashAdvance.aggregate({
      where: { accountId },
      _sum: { amount: true },
    }),
    prisma.finExpense.aggregate({
      where: { pettyCashAccountId: accountId, status: { not: 'rejected' } },
      _sum: { amount: true },
    }),
  ]);

  const totalAdvances = advancesTotal._sum.amount ?? 0;
  const totalExpenses = expensesTotal._sum.amount ?? 0;

  return {
    accountId,
    totalAdvances,
    totalExpenses,
    balance: totalAdvances - totalExpenses,
  };
}

export interface CreateAdvanceData {
  tenantId: string;
  accountId: string;
  amount: number;
  advanceDate: string;
  issuedBy?: string;
  remark?: string;
}

export async function createPettyCashAdvance(data: CreateAdvanceData) {
  return prisma.finPettyCashAdvance.create({
    data: {
      tenantId: data.tenantId,
      accountId: data.accountId,
      amount: data.amount,
      advanceDate: data.advanceDate,
      issuedBy: data.issuedBy,
      remark: data.remark,
    },
  });
}

export async function listPettyCashAdvances(params: { tenantId: string; accountId?: string; page?: number; pageSize?: number }) {
  const { tenantId, accountId, page = 1, pageSize = 50 } = params;
  const where: any = { tenantId };
  if (accountId) where.accountId = accountId;

  const [items, total] = await Promise.all([
    prisma.finPettyCashAdvance.findMany({
      where,
      include: { account: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.finPettyCashAdvance.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// Get all accounts with their current balance
export async function listPettyCashAccountsWithBalance(params: { tenantId: string; contractId?: string; departmentId?: string }) {
  const { tenantId, contractId, departmentId } = params;
  const where: any = { tenantId, isActive: true };
  if (contractId) where.contractId = contractId;
  if (departmentId) where.departmentId = departmentId;

  const accounts = await prisma.finPettyCashAccount.findMany({ where, orderBy: { createdAt: 'desc' } });

  const result = [];
  for (const account of accounts) {
    const balance = await getPettyCashBalance(account.id);
    result.push({ ...account, ...balance });
  }
  return result;
}

// List expenses paid by a specific petty cash account
export async function listPettyCashExpenses(accountId: string, params?: { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 20 } = params || {};
  const [items, total] = await Promise.all([
    prisma.finExpense.findMany({
      where: { pettyCashAccountId: accountId },
      include: { category: true, subCategory: true },
      orderBy: { expenseDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.finExpense.count({ where: { pettyCashAccountId: accountId } }),
  ]);
  return { items, total, page, pageSize };
}

// ============================================
// Enhanced Summary Queries
// ============================================

// Comprehensive dashboard summary - returns totals for the current month and year
export async function getDashboardSummary(tenantId: string) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = `${now.getFullYear()}`;
  const monthStart = `${currentMonth}-01`;
  const monthEnd = `${currentMonth}-31`;
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const [monthExpenses, yearExpenses, pendingCount, approvedTotal] = await Promise.all([
    prisma.finExpense.aggregate({
      where: { tenantId, status: 'approved', expenseDate: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.finExpense.aggregate({
      where: { tenantId, status: 'approved', expenseDate: { gte: yearStart, lte: yearEnd } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.finExpense.count({
      where: { tenantId, status: 'pending' },
    }),
    prisma.finExpense.aggregate({
      where: { tenantId, status: 'approved' },
      _sum: { amount: true },
    }),
  ]);

  // Petty cash total balance
  const accounts = await prisma.finPettyCashAccount.findMany({ where: { tenantId, isActive: true } });
  let pettyCashBalance = 0;
  for (const acc of accounts) {
    const advSum = await prisma.finPettyCashAdvance.aggregate({ where: { accountId: acc.id }, _sum: { amount: true } });
    const expSum = await prisma.finExpense.aggregate({ where: { pettyCashAccountId: acc.id, status: { not: 'rejected' } }, _sum: { amount: true } });
    pettyCashBalance += (advSum._sum.amount ?? 0) - (expSum._sum.amount ?? 0);
  }

  return {
    monthExpenseTotal: monthExpenses._sum.amount ?? 0,
    monthExpenseCount: monthExpenses._count.id,
    yearExpenseTotal: yearExpenses._sum.amount ?? 0,
    yearExpenseCount: yearExpenses._count.id,
    pendingCount,
    approvedTotal: approvedTotal._sum.amount ?? 0,
    pettyCashBalance,
  };
}

// Monthly trend - expenses by month for the last N months
export async function getMonthlyTrend(tenantId: string, months: number = 12) {
  const result: Array<{ month: string; total: number; count: number }> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const agg = await prisma.finExpense.aggregate({
      where: {
        tenantId,
        status: 'approved',
        expenseDate: { gte: `${month}-01`, lte: `${month}-31` },
      },
      _sum: { amount: true },
      _count: { id: true },
    });
    result.push({
      month,
      total: agg._sum.amount ?? 0,
      count: agg._count.id,
    });
  }
  return result;
}

// Category breakdown for pie chart
export async function getCategoryBreakdown(tenantId: string, startDate?: string, endDate?: string) {
  const categories = await prisma.finCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const result = [];
  for (const cat of categories) {
    const where: any = { tenantId, categoryId: cat.id, status: 'approved' };
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = startDate;
      if (endDate) where.expenseDate.lte = endDate;
    }
    const agg = await prisma.finExpense.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    });
    result.push({
      categoryId: cat.id,
      categoryName: cat.name,
      total: agg._sum.amount ?? 0,
      count: agg._count.id,
    });
  }
  return result;
}

// Department expense ranking
export async function getDepartmentRanking(tenantId: string, month?: string) {
  const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const where: any = { tenantId, status: 'approved', expenseDate: { gte: `${targetMonth}-01`, lte: `${targetMonth}-31` } };

  const departments = await prisma.department.findMany({ where: { tenantId, isActive: true } });
  const ranking = [];

  for (const dept of departments) {
    const agg = await prisma.finExpense.aggregate({
      where: { ...where, departmentId: dept.id },
      _sum: { amount: true },
      _count: { id: true },
    });
    ranking.push({
      departmentId: dept.id,
      departmentName: dept.name,
      total: agg._sum.amount ?? 0,
      count: agg._count.id,
    });
  }

  ranking.sort((a, b) => b.total - a.total);
  return ranking;
}

// ============================================
// Import / Export
// ============================================

export async function importExpenses(tenantId: string, rows: ImportExpenseRow[], userId: string) {
  const errors: Array<{ row: number; error: string }> = [];
  const successes: Array<{ row: number; id: string }> = [];

  // Pre-fetch categories for name->id mapping
  const categories = await prisma.finCategory.findMany({
    where: { tenantId },
    include: { subCategories: true },
  });

  // Pre-fetch contracts and departments
  const contracts = await prisma.contract.findMany({ where: { tenantId } });
  const departments = await prisma.department.findMany({ where: { tenantId } });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.handler || !row.categoryName || !row.amount) {
        errors.push({ row: i + 2, error: '必填字段缺失（经办人、类别、金额）' });
        continue;
      }

      const category = categories.find(c => c.name === row.categoryName);
      if (!category) {
        errors.push({ row: i + 2, error: `未找到类别: ${row.categoryName}` });
        continue;
      }

      let subCategoryId: string | undefined;
      if (row.subCategoryName) {
        const sub = category.subCategories.find(s => s.name === row.subCategoryName);
        if (!sub) {
          errors.push({ row: i + 2, error: `未找到子类: ${row.subCategoryName}` });
          continue;
        }
        subCategoryId = sub.id;
      }

      let contractId: string | undefined;
      if (row.contractName) {
        const c = contracts.find(c => c.name === row.contractName);
        if (!c) {
          errors.push({ row: i + 2, error: `未找到合同: ${row.contractName}` });
          continue;
        }
        contractId = c.id;
      }

      let departmentId: string | undefined;
      if (row.departmentName) {
        const d = departments.find(d => d.name === row.departmentName);
        if (!d) {
          errors.push({ row: i + 2, error: `未找到项目部: ${row.departmentName}` });
          continue;
        }
        departmentId = d.id;
      }

      const expense = await prisma.finExpense.create({
        data: {
          tenantId,
          source: 'company_finance',
          enteredBy: userId,
          contractId: contractId ?? null,
          departmentId: departmentId ?? null,
          handler: row.handler,
          categoryId: category.id,
          subCategoryId: subCategoryId ?? null,
          amount: row.amount,
          paymentMethod: row.paymentMethod || 'company_direct',
          payer: row.payer || row.handler,
          expenseDate: row.expenseDate,
          detail: row.detail ?? null,
          status: 'approved',
          reviewedBy: userId,
        },
      });
      successes.push({ row: i + 2, id: expense.id });
    } catch (err: any) {
      errors.push({ row: i + 2, error: err.message || '未知错误' });
    }
  }

  // Log the import
  await prisma.finImportLog.create({
    data: {
      tenantId,
      fileName: 'manual_import',
      totalRows: rows.length,
      successRows: successes.length,
      errorRows: errors.length,
      errorDetail: errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null,
    },
  });

  return { successes, errors };
}

// Export expenses to a simple structured format (frontend will convert to Excel)
export async function exportExpensesData(tenantId: string, params: FinanceListParams) {
  const { items } = await listExpenses({ ...params, tenantId, page: 1, pageSize: 10000 });
  return items.map(e => ({
    '日期': e.expenseDate,
    '来源': e.source === 'project_department' ? '项目部报账' : '公司财务凭证',
    '经办人': e.handler,
    '费用大类': e.category?.name || '',
    '费用子类': (e as any).subCategory?.name || '',
    '金额': e.amount,
    '支付方式': e.paymentMethod === 'petty_cash' ? '备用金' : '公司直付',
    '支付人': e.payer,
    '详情': e.detail || '',
    '状态': e.status === 'approved' ? '已审核' : e.status === 'rejected' ? '已拒绝' : '待审核',
  }));
}

// ============================================
// Invoice CRUD
// ============================================

export interface CreateInvoiceData {
  tenantId: string;
  contractId?: string;
  invoiceNo: string;
  invoiceType?: string;
  invoiceDate: string;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  buyerName?: string;
  description?: string;
  imagePath?: string;
}

export async function listInvoices(params: { tenantId: string; contractId?: string; status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }) {
  const { tenantId, contractId, status, startDate, endDate, page = 1, pageSize = 20 } = params;
  const where: any = { tenantId };
  if (contractId) where.contractId = contractId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.invoiceDate = {};
    if (startDate) where.invoiceDate.gte = startDate;
    if (endDate) where.invoiceDate.lte = endDate;
  }

  const [items, total] = await Promise.all([
    prisma.finInvoice.findMany({
      where,
      include: { receipts: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.finInvoice.count({ where }),
  ]);

  // Calculate received/outstanding for each invoice
  const enriched = items.map(inv => {
    const totalReceived = inv.receipts.reduce((sum, r) => sum + r.amount, 0);
    return { ...inv, totalReceived, outstanding: inv.amount - totalReceived };
  });

  return { items: enriched, total, page, pageSize };
}

export async function createInvoice(data: CreateInvoiceData) {
  return prisma.finInvoice.create({
    data: {
      tenantId: data.tenantId,
      contractId: data.contractId ?? null,
      invoiceNo: data.invoiceNo,
      invoiceType: data.invoiceType ?? 'vat_special',
      invoiceDate: data.invoiceDate,
      amount: data.amount,
      taxRate: data.taxRate ?? 0,
      taxAmount: data.taxAmount ?? 0,
      buyerName: data.buyerName ?? null,
      description: data.description ?? null,
      imagePath: data.imagePath ?? null,
    },
  });
}

export async function updateInvoice(id: string, data: Partial<CreateInvoiceData>) {
  const updateData: any = {};
  if (data.contractId !== undefined) updateData.contractId = data.contractId ?? null;
  if (data.invoiceNo !== undefined) updateData.invoiceNo = data.invoiceNo;
  if (data.invoiceType !== undefined) updateData.invoiceType = data.invoiceType;
  if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.taxRate !== undefined) updateData.taxRate = data.taxRate;
  if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
  if (data.buyerName !== undefined) updateData.buyerName = data.buyerName ?? null;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.imagePath !== undefined) updateData.imagePath = data.imagePath ?? null;
  return prisma.finInvoice.update({ where: { id }, data: updateData });
}

export async function deleteInvoice(id: string) {
  return prisma.finInvoice.delete({ where: { id } });
}

export async function getInvoiceDetail(id: string) {
  const invoice = await prisma.finInvoice.findUnique({
    where: { id },
    include: {
      receipts: { orderBy: { receiptDate: 'desc' } },
    },
  });
  if (!invoice) throw { status: 404, code: 'INVOICE_NOT_FOUND', message: '发票不存在' };
  const totalReceived = invoice.receipts.reduce((sum, r) => sum + r.amount, 0);
  return { ...invoice, totalReceived, outstanding: invoice.amount - totalReceived };
}

// ============================================
// Receipt CRUD
// ============================================

export interface CreateReceiptData {
  tenantId: string;
  contractId: string;
  invoiceId?: string;
  amount: number;
  receiptDate: string;
  paymentMethod?: string;
  payerName?: string;
  bankAccount?: string;
  transactionNo?: string;
  enteredBy: string;
  remark?: string;
}

export async function listReceipts(params: { tenantId: string; contractId?: string; invoiceId?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }) {
  const { tenantId, contractId, invoiceId, startDate, endDate, page = 1, pageSize = 20 } = params;
  const where: any = { tenantId };
  if (contractId) where.contractId = contractId;
  if (invoiceId) where.invoiceId = invoiceId;
  if (startDate || endDate) {
    where.receiptDate = {};
    if (startDate) where.receiptDate.gte = startDate;
    if (endDate) where.receiptDate.lte = endDate;
  }

  const [items, total] = await Promise.all([
    prisma.finReceipt.findMany({
      where,
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.finReceipt.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function createReceipt(data: CreateReceiptData) {
  return prisma.finReceipt.create({
    data: {
      tenantId: data.tenantId,
      contractId: data.contractId,
      invoiceId: data.invoiceId ?? null,
      amount: data.amount,
      receiptDate: data.receiptDate,
      paymentMethod: data.paymentMethod ?? 'bank_transfer',
      payerName: data.payerName ?? null,
      bankAccount: data.bankAccount ?? null,
      transactionNo: data.transactionNo ?? null,
      enteredBy: data.enteredBy,
      remark: data.remark ?? null,
    },
    include: { invoice: true },
  });
}

export async function updateReceipt(id: string, data: Partial<CreateReceiptData>) {
  return prisma.finReceipt.update({ where: { id }, data: data as any });
}

export async function deleteReceipt(id: string) {
  return prisma.finReceipt.delete({ where: { id } });
}

// ============================================
// Receipt Summary
// ============================================

export async function getReceiptsSummary(tenantId: string) {
  // Per-contract: invoice total, received total, outstanding
  const contracts = await prisma.contract.findMany({ where: { tenantId, isActive: true } });
  const result = [];

  for (const contract of contracts) {
    const invoices = await prisma.finInvoice.findMany({
      where: { contractId: contract.id },
      include: { receipts: true },
    });
    const invoiceTotal = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const receivedTotal = invoices.reduce((sum, inv) => sum + inv.receipts.reduce((s, r) => s + r.amount, 0), 0);

    result.push({
      contractId: contract.id,
      contractName: contract.name,
      contractAmount: contract.totalAmount,
      invoiceTotal,
      receivedTotal,
      outstanding: invoiceTotal - receivedTotal,
      invoiceCount: invoices.length,
    });
  }
  return result;
}

export async function getOverdueReceipts(tenantId: string) {
  // Invoices with outstanding amount (invoice date > 90 days ago and not fully received)
  const invoices = await prisma.finInvoice.findMany({
    where: { tenantId, status: 'issued' },
    include: { receipts: true },
  });

  const overdue = invoices
    .map(inv => {
      const received = inv.receipts.reduce((sum, r) => sum + r.amount, 0);
      const outstanding = inv.amount - received;
      const daysSinceInvoice = Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
      return { ...inv, totalReceived: received, outstanding, daysSinceInvoice };
    })
    .filter(inv => inv.outstanding > 0 && inv.daysSinceInvoice > 90)
    .sort((a, b) => b.outstanding - a.outstanding);

  return overdue;
}

// ============================================
// 合同损益（Contract P&L）分析
// ============================================

export interface ContractPnlSummary {
  contractId: string;
  contractName: string;
  contractCode: string | null;
  contractAmount: number | null;
  // Income
  invoiceTotal: number;
  receiptTotal: number;
  progressPaymentTotal: number;
  totalIncome: number;
  // Expenses
  expenseTotal: number;
  expenseByCategory: Array<{ categoryName: string; total: number }>;
  pettyCashExpenseTotal: number;
  companyDirectExpenseTotal: number;
  subcontractPaid: number;
  subcontractOwed: number;  // outputValue - subcontractPaid
  workerSalaryTotal: number;
  totalExpense: number;
  // Summary
  profit: number;           // totalIncome - totalExpense
  advanceAmount: number;    // totalExpense - totalIncome (when negative profit)
  profitMargin: number;     // profit / totalIncome * 100
  status: 'profit' | 'balance' | 'loss'; // 盈利/平账/垫付
}

export async function getContractPnl(contractId: string, tenantId: string): Promise<ContractPnlSummary> {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw { status: 404, code: 'CONTRACT_NOT_FOUND', message: '合同不存在' };

  // --- Income ---
  // Invoice total (only issued invoices)
  const invoiceAgg = await prisma.finInvoice.aggregate({
    where: { contractId, status: 'issued' },
    _sum: { amount: true },
  });

  // Receipt total
  const receiptAgg = await prisma.finReceipt.aggregate({
    where: { contractId },
    _sum: { amount: true },
  });

  // Progress payment total (existing contract progress collection)
  const progressAgg = await prisma.progressPayment.aggregate({
    where: { contractId },
    _sum: { amount: true },
  });

  const invoiceTotal = invoiceAgg._sum.amount ?? 0;
  const receiptTotal = receiptAgg._sum.amount ?? 0;
  const progressPaymentTotal = progressAgg._sum.amount ?? 0;
  const totalIncome = receiptTotal;

  // --- Expenses ---
  // FinExpense by category
  const expenses = await prisma.finExpense.findMany({
    where: { contractId, status: 'approved' },
    include: { category: true },
  });

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const pettyCashExpenseTotal = expenses.filter(e => e.paymentMethod === 'petty_cash').reduce((sum, e) => sum + e.amount, 0);
  const companyDirectExpenseTotal = expenses.filter(e => e.paymentMethod === 'company_direct').reduce((sum, e) => sum + e.amount, 0);

  // Expenses by category
  const categoryMap = new Map<string, number>();
  for (const e of expenses) {
    const name = e.category?.name || '未分类';
    categoryMap.set(name, (categoryMap.get(name) || 0) + e.amount);
  }
  const expenseByCategory = Array.from(categoryMap.entries())
    .map(([categoryName, total]) => ({ categoryName, total }))
    .sort((a, b) => b.total - a.total);

  // --- Subcontract costs ---
  const subContracts = await prisma.subContract.findMany({
    where: { contractId, isActive: true },
  });

  let subcontractPaid = 0;
  let subcontractOwed = 0;

  for (const sc of subContracts) {
    const [paidAgg, outputAgg] = await Promise.all([
      prisma.subProgressPayment.aggregate({
        where: { subContractId: sc.id },
        _sum: { totalAmount: true },
      }),
      prisma.outputValue.aggregate({
        where: { subContractId: sc.id },
        _sum: { amount: true },
      }),
    ]);
    subcontractPaid += paidAgg._sum.totalAmount ?? 0;
    subcontractOwed += (outputAgg._sum.amount ?? 0) - (paidAgg._sum.totalAmount ?? 0);
  }

  // --- Worker salary ---
  // Attempt to filter by contract's departments; fall back to tenant-wide if none
  const contractDepartments = await prisma.department.findMany({
    where: { contractId, isActive: true },
    select: { id: true },
  });
  const departmentIds = contractDepartments.map(d => d.id);

  let workerSalaryTotal = 0;
  if (departmentIds.length > 0) {
    const salaryAgg = await prisma.paymentRecord.aggregate({
      where: {
        departmentId: { in: departmentIds },
        isConfirmed: true,
      },
      _sum: { amount: true },
    });
    workerSalaryTotal = salaryAgg._sum.amount ?? 0;
  } else {
    // No departments linked — rough estimate: sum all confirmed payments for tenant
    const salaryAgg = await prisma.paymentRecord.aggregate({
      where: {
        isConfirmed: true,
      },
      _sum: { amount: true },
    });
    workerSalaryTotal = salaryAgg._sum.amount ?? 0;
  }

  // --- Calculate totals ---
  const totalExpense = expenseTotal + subcontractPaid + workerSalaryTotal;
  const profit = totalIncome - totalExpense;
  const advanceAmount = profit < 0 ? Math.abs(profit) : 0;
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

  let status: 'profit' | 'balance' | 'loss';
  if (profit > 100) status = 'profit';       // More than 100 yuan profit
  else if (profit < -100) status = 'loss';    // More than 100 yuan loss
  else status = 'balance';                     // Roughly even

  return {
    contractId: contract.id,
    contractName: contract.name,
    contractCode: contract.code,
    contractAmount: contract.totalAmount,
    invoiceTotal,
    receiptTotal,
    progressPaymentTotal,
    totalIncome,
    expenseTotal,
    expenseByCategory,
    pettyCashExpenseTotal,
    companyDirectExpenseTotal,
    subcontractPaid,
    subcontractOwed,
    workerSalaryTotal,
    totalExpense,
    profit,
    advanceAmount,
    profitMargin,
    status,
  };
}

export async function listContractsPnl(tenantId: string) {
  const contracts = await prisma.contract.findMany({
    where: { tenantId, isActive: true },
  });

  const results = [];
  for (const contract of contracts) {
    const pnl = await getContractPnl(contract.id, tenantId);
    results.push(pnl);
  }

  // Sort by profit descending (most profitable first)
  results.sort((a, b) => b.profit - a.profit);

  return results;
}
