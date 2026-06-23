// ============================================
// 开发者后台 - 业务逻辑层
// ============================================
// OCR/AI 配置管理保留在 routes.ts 中
// 本文件包含：看板统计、租户管理、用户管理、套餐、支付、存储、监控等

import bcrypt from 'bcryptjs';
import { prisma } from '../../common/utils/prisma';
import {
  ensureTenantModuleEntitlements,
  isTenantModuleKey,
  TENANT_MODULE_KEYS,
  TenantModuleKey,
  updateTenantModuleEntitlements,
} from '../../common/services/module-entitlement.service';
import {
  getTenantPortalConfig,
  TenantPortalInput,
  updateTenantPortalConfig,
} from '../../common/services/tenant-portal.service';
import { getFaceProviderDiagnostic } from '../labor/face-provider';

// ============================================
// 全局数据看板
// ============================================

export async function getDashboard() {
  const [tenantCount, activeTenantCount, userCount, activeUserCount, contractCount, departmentCount, activeDepartmentCount, subscriptionStats] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.contract.count(),
    prisma.department.count(),
    prisma.department.count({ where: { isActive: true } }),
    prisma.subscription.groupBy({ by: ['plan'], _count: { id: true } }),
  ]);

  const subscriptionByPlan: Record<string, number> = {};
  subscriptionStats.forEach((s) => { subscriptionByPlan[s.plan] = s._count.id; });

  return {
    tenants: { total: tenantCount, active: activeTenantCount },
    users: { total: userCount, active: activeUserCount },
    contracts: { total: contractCount },
    departments: { total: departmentCount, active: activeDepartmentCount },
    subscriptions: { byPlan: subscriptionByPlan, total: subscriptionStats.reduce((sum, s) => sum + s._count.id, 0) },
  };
}

// ============================================
// 综合统计数据
// ============================================

export async function getComprehensiveStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalTenants, activeTenants, totalUsers, activeUsers,
    thisMonthTenants, thisMonthUsers,
    subscriptionStats, paymentStats, thisMonthPayments,
    attachmentStats, thisMonthAttachments,
    apiUsageStats, thisMonthApiUsage, onlineCount,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.subscriptionPayment.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
    prisma.subscriptionPayment.aggregate({ _sum: { amount: true }, where: { status: 'completed', paidAt: { gte: startOfMonth } } }),
    prisma.attachment.aggregate({ _sum: { fileSize: true } }),
    prisma.attachment.aggregate({ _sum: { fileSize: true }, where: { createdAt: { gte: startOfMonth } } }),
    prisma.apiUsageLog.count(),
    prisma.apiUsageLog.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.onlineSession.count({ where: { loggedOutAt: null } }),
  ]);

  const subscriptionByStatus: Record<string, number> = {};
  subscriptionStats.forEach((s) => { subscriptionByStatus[s.status] = s._count.id; });

  return {
    tenants: { total: totalTenants, active: activeTenants, newThisMonth: thisMonthTenants },
    users: { total: totalUsers, active: activeUsers, newThisMonth: thisMonthUsers },
    revenue: { total: paymentStats._sum.amount || 0, thisMonth: thisMonthPayments._sum.amount || 0 },
    subscriptions: { byStatus: subscriptionByStatus, total: subscriptionStats.reduce((sum, s) => sum + s._count.id, 0) },
    attachments: { totalSize: attachmentStats._sum.fileSize || 0, newThisMonth: thisMonthAttachments._sum.fileSize || 0 },
    apiUsage: { total: apiUsageStats, thisMonth: thisMonthApiUsage },
    onlineUsers: onlineCount,
  };
}

export async function getUsageRanking(sortBy: string, sortOrder: string, limit: number) {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, _count: { select: { users: true } } },
  });
  const tenantIds = tenants.map((t) => t.id);

  const [apiUsageMap, storageMap] = await Promise.all([
    prisma.apiUsageLog.groupBy({ by: ['tenantId'], where: { tenantId: { in: tenantIds } }, _count: { id: true } }),
    prisma.attachment.groupBy({ by: ['tenantId'], where: { tenantId: { in: tenantIds } }, _sum: { fileSize: true } }),
  ]);

  const apiMap = new Map(apiUsageMap.map((a) => [a.tenantId, a._count.id]));
  const storageMapMap = new Map(storageMap.map((s) => [s.tenantId, s._sum.fileSize || 0]));

  let usageList = tenants.map((t) => ({
    id: t.id, name: t.name, code: t.code,
    userCount: t._count.users,
    apiUsage: apiMap.get(t.id) || 0,
    storage: storageMapMap.get(t.id) || 0,
  }));

  usageList.sort((a, b) => {
    const mul = sortOrder === 'desc' ? -1 : 1;
    if (sortBy === 'storage') return mul * (a.storage - b.storage);
    if (sortBy === 'users') return mul * (a.userCount - b.userCount);
    return mul * (a.apiUsage - b.apiUsage);
  });

  return usageList.slice(0, limit);
}

export async function getRevenueTrend(months: number) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const payments = await prisma.subscriptionPayment.findMany({
    where: { status: 'completed', paidAt: { gte: startDate } },
    select: { amount: true, paidAt: true },
    orderBy: { paidAt: 'asc' },
  });

  const monthlyMap: Record<string, number> = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    monthlyMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }

  payments.forEach((p) => {
    if (!p.paidAt) return;
    const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyMap[key] !== undefined) monthlyMap[key] += p.amount;
  });

  return Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));
}

export async function getDailyStats(days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const [tenants, users] = await Promise.all([
    prisma.tenant.findMany({ where: { createdAt: { gte: startDate } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
    prisma.user.findMany({ where: { createdAt: { gte: startDate } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
  ]);

  const dailyMap: Record<string, { tenants: number; users: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dailyMap[d.toISOString().split('T')[0]] = { tenants: 0, users: 0 };
  }

  tenants.forEach((t) => { const k = t.createdAt.toISOString().split('T')[0]; if (dailyMap[k]) dailyMap[k].tenants++; });
  users.forEach((u) => { const k = u.createdAt.toISOString().split('T')[0]; if (dailyMap[k]) dailyMap[k].users++; });

  return Object.entries(dailyMap).map(([date, stats]) => ({ date, ...stats }));
}

// ============================================
// 系统配置
// ============================================

export const listSystemConfigs = () => prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });

export const upsertSystemConfig = (key: string, value: string, description?: string) =>
  prisma.systemConfig.upsert({ where: { key }, update: { value, description }, create: { key, value, description } });

export const deleteSystemConfig = (key: string) => prisma.systemConfig.delete({ where: { key } });

// ============================================
// 租户管理
// ============================================

export interface TenantListParams {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: string;
}

export async function listTenants(params: TenantListParams) {
  const { page, pageSize, search, isActive: isActiveFilter } = params;
  const where: any = { deletedAt: null };
  if (search) where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
  if (isActiveFilter === 'true') where.isActive = true;
  else if (isActiveFilter === 'false') where.isActive = false;

  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { subscription: { select: { plan: true, tier: true, status: true, currentPeriodEnd: true } }, users: { select: { id: true } }, departments: { select: { id: true } } },
    }),
  ]);

  const formattedTenants = tenants.map((t) => ({
    id: t.id, name: t.name, code: t.code, contactName: t.contactName, contactPhone: t.contactPhone,
    address: t.address, isActive: t.isActive, subscription: t.subscription,
    userCount: t.users.length, departmentCount: t.departments.length,
    createdAt: t.createdAt, updatedAt: t.updatedAt,
  }));

  return { tenants: formattedTenants, total, totalPages: Math.ceil(total / pageSize) };
}

export interface CreateTenantInput {
  name: string;
  code: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
}

export async function createTenant(input: CreateTenantInput) {
  const { name, code, contactName, contactPhone, address } = input;
  const existingTenant = await prisma.tenant.findUnique({ where: { code } });
  if (existingTenant) throw { status: 409, code: 'DUPLICATE_CODE', message: '企业代码已存在' };

  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({ data: { name, code, contactName, contactPhone, address } });
    const trialEndAt = new Date();
    trialEndAt.setDate(trialEndAt.getDate() + 30);

    await tx.subscription.create({
      data: { tenantId: newTenant.id, plan: 'FULL', tier: 'SMALL', maxUsers: 5, pricePerMonth: 888, pricePerExtraUser: 100, currentUsers: 0, status: 'TRIAL', trialEndAt, currentPeriodStart: new Date(), currentPeriodEnd: trialEndAt },
    });

    const defaultRoles = [
      { name: 'super_admin', displayName: '超级管理员', description: '企业管理最高权限', isDefault: true },
      { name: 'boss', displayName: '老板', description: '企业负责人', isDefault: true },
      { name: 'admin', displayName: '管理员', description: '企业管理员', isDefault: true },
      { name: 'material', displayName: '物资员', description: '物资管理操作人员', isDefault: true },
      { name: 'labor', displayName: '劳资员', description: '劳资管理操作人员', isDefault: true },
      { name: 'finance', displayName: '财务', description: '财务管理操作人员', isDefault: true },
      { name: 'cashier', displayName: '出纳', description: '出纳操作人员', isDefault: true },
      { name: 'project_cashier', displayName: '项目出纳', description: '项目出纳操作人员', isDefault: true },
    ];

    for (const role of defaultRoles) {
      const createdRole = await tx.role.create({ data: { tenantId: newTenant.id, name: role.name, displayName: role.displayName, description: role.description, isDefault: role.isDefault } });
      await tx.permission.create({ data: { roleId: createdRole.id } });
    }

    await tx.tenantModuleEntitlement.createMany({
      data: TENANT_MODULE_KEYS.map(moduleKey => ({
        tenantId: newTenant.id,
        moduleKey,
        isEnabled: true,
        enabledAt: new Date(),
        remark: '新企业默认试用开通',
      })),
    });

    return newTenant;
  });

  return tenant;
}

export async function updateTenant(id: string, data: { name?: string; contactName?: string; contactPhone?: string; address?: string }) {
  const existingTenant = await prisma.tenant.findUnique({ where: { id } });
  if (!existingTenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.address !== undefined) updateData.address = data.address;
  const updated = await prisma.tenant.update({ where: { id }, data: updateData });
  return { oldName: existingTenant.name, updated };
}

export async function toggleTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  const updated = await prisma.tenant.update({ where: { id }, data: { isActive: !tenant.isActive } });
  return { updated, wasActive: tenant.isActive, tenantName: tenant.name };
}

export async function getTenantModules(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  return ensureTenantModuleEntitlements(tenantId);
}

export async function setTenantModules(tenantId: string, modules: Array<{ moduleKey: string; isEnabled: boolean; expiresAt?: string | null; remark?: string | null }>) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };

  const normalized = modules.map((item) => {
    if (!isTenantModuleKey(item.moduleKey)) {
      throw { status: 400, code: 'INVALID_MODULE', message: `不支持的模块：${item.moduleKey}` };
    }
    return {
      moduleKey: item.moduleKey as TenantModuleKey,
      isEnabled: Boolean(item.isEnabled),
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
      remark: item.remark ?? null,
    };
  });

  return updateTenantModuleEntitlements(tenantId, normalized);
}

export async function getTenantPortal(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  return getTenantPortalConfig(tenantId);
}

export async function setTenantPortal(tenantId: string, input: TenantPortalInput) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  return updateTenantPortalConfig(tenantId, input);
}

// ============================================
// 回收站
// ============================================

export async function listRecycledTenants(page: number, pageSize: number) {
  const where = { deletedAt: { not: null } };
  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { deletedAt: 'desc' } }),
  ]);
  const formatted = tenants.map((t) => ({
    id: t.id, name: t.name, code: t.code, contactName: t.contactName,
    contactPhone: t.contactPhone, address: t.address, isActive: t.isActive,
    deletedAt: t.deletedAt, createdAt: t.createdAt, updatedAt: t.updatedAt,
  }));
  return { tenants: formatted, total, totalPages: Math.ceil(total / pageSize) };
}

export async function softDeleteTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  if (tenant.deletedAt) throw { status: 400, code: 'ALREADY_DELETED', message: '该企业已在回收站中' };
  await prisma.tenant.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  return { tenantName: tenant.name };
}

export async function restoreTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  if (!tenant.deletedAt) throw { status: 400, code: 'NOT_DELETED', message: '该企业不在回收站中' };
  await prisma.tenant.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  return { tenantName: tenant.name };
}

async function purgeTenantForPermanentDelete(tx: any, tenantId: string) {
  const [users, roles, subscription] = await Promise.all([
    tx.user.findMany({ where: { tenantId }, select: { id: true } }),
    tx.role.findMany({ where: { tenantId }, select: { id: true } }),
    tx.subscription.findUnique({ where: { tenantId }, select: { id: true } }),
  ]);
  const userIds = users.map((user: { id: string }) => user.id);
  const roleIds = roles.map((role: { id: string }) => role.id);

  // SQLite does not reliably topologically sort tenant cascades when roles are
  // restricted by users in the physical schema. Clear direct dependents first,
  // then let the final tenant delete handle the broader cascade tree.
  await tx.operationLog.updateMany({
    where: {
      OR: [
        { tenantId },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ],
    },
    data: { tenantId: null, userId: null },
  });
  await tx.refreshToken.deleteMany({
    where: {
      OR: [
        { tenantId },
        ...(userIds.length ? [{ userType: 'user', userId: { in: userIds } }] : []),
      ],
    },
  });
  if (subscription) {
    await tx.subscriptionPayment.deleteMany({ where: { subscriptionId: subscription.id } });
    await tx.subscription.deleteMany({ where: { tenantId } });
  }
  if (roleIds.length) {
    await tx.permission.deleteMany({ where: { roleId: { in: roleIds } } });
  }
  await tx.user.deleteMany({ where: { tenantId } });
  await tx.role.deleteMany({ where: { tenantId } });
  await tx.tenantModuleEntitlement.deleteMany({ where: { tenantId } });
  await tx.tenantPortalConfig.deleteMany({ where: { tenantId } });
  await tx.miniProgramConfig.deleteMany({ where: { tenantId } });
  await tx.attendanceSetting.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
}

export async function permanentDeleteTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  if (!tenant.deletedAt) throw { status: 400, code: 'NOT_DELETED', message: '请先将企业移入回收站' };
  await prisma.$transaction(async (tx) => {
    await purgeTenantForPermanentDelete(tx, id);
  });
  return { tenantName: tenant.name, tenantCode: tenant.code };
}

export async function clearRecycleBin() {
  const deletedTenants = await prisma.tenant.findMany({ where: { deletedAt: { not: null } }, select: { id: true, name: true, code: true } });
  for (const tenant of deletedTenants) {
    await prisma.$transaction(async (tx) => {
      await purgeTenantForPermanentDelete(tx, tenant.id);
    });
  }
  return { count: deletedTenants.length };
}

// ============================================
// 租户用户管理
// ============================================

export async function listTenantUsers(tenantId: string, page: number, pageSize: number) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };

  const [total, users] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.user.findMany({
      where: { tenantId }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { role: { select: { id: true, name: true, displayName: true } }, department: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  const formatted = users.map(({ passwordHash: _, ...user }) => user);
  return { users: formatted, total, totalPages: Math.ceil(total / pageSize) };
}

export async function listTenantRoles(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };
  return prisma.role.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, displayName: true, isDefault: true },
  });
}

export interface CreateTenantUserInput {
  tenantId: string;
  username: string;
  password: string;
  name: string;
  phone?: string;
  email?: string;
  roleId: string;
  departmentId?: string;
  dataScope?: string;
}

export async function createTenantUser(input: CreateTenantUserInput) {
  const { tenantId, username, password, name, phone, email, roleId, departmentId, dataScope } = input;
  if (password.length < 6) throw { status: 400, code: 'WEAK_PASSWORD', message: '密码长度不能少于6位' };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '指定的企业不存在' };

  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw { status: 400, code: 'INVALID_ROLE', message: '指定的角色不存在或不属于该企业' };

  const existingUser = await prisma.user.findUnique({ where: { tenantId_username: { tenantId, username } } });
  if (existingUser) throw { status: 409, code: 'DUPLICATE_USERNAME', message: '该用户名在此企业中已存在' };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { tenantId, departmentId: departmentId || null, username, passwordHash, name, phone, email, roleId, dataScope: dataScope || 'OWN_DEPARTMENT' },
    include: { role: { select: { id: true, name: true, displayName: true } } },
  });
  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, tenantName: tenant.name };
}

export async function updateTenantUser(tenantId: string, userId: string, data: { name?: string; phone?: string; email?: string; roleId?: string; departmentId?: string; dataScope?: string }) {
  const existingUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!existingUser) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在' };

  if (data.roleId) {
    const role = await prisma.role.findFirst({ where: { id: data.roleId, tenantId } });
    if (!role) throw { status: 400, code: 'INVALID_ROLE', message: '指定的角色不存在或不属于该企业' };
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.roleId !== undefined) updateData.roleId = data.roleId;
  if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
  if (data.dataScope !== undefined) updateData.dataScope = data.dataScope;

  const updatedUser = await prisma.user.update({
    where: { id: userId }, data: updateData,
    include: { role: { select: { id: true, name: true, displayName: true } }, department: { select: { id: true, name: true, code: true } } },
  });
  const { passwordHash: _, ...userWithoutPassword } = updatedUser;
  return { oldName: existingUser.name, updated: userWithoutPassword };
}

export async function toggleTenantUser(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在' };
  const updated = await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  return { updated, wasActive: user.isActive, userName: user.name };
}

export async function resetTenantUserPassword(tenantId: string, userId: string, newPassword: string) {
  if (newPassword.length < 6) throw { status: 400, code: 'WEAK_PASSWORD', message: '新密码长度不能少于6位' };
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在' };
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });
  return { userName: user.name };
}

// ============================================
// 套餐管理
// ============================================

export const listPlatformPlans = () => prisma.platformPlan.findMany({ orderBy: { sortOrder: 'asc' } });

export interface CreatePlanInput {
  name: string; tier?: string; type?: string; modules?: string;
  pricePerMonth: number; maxUsers?: number; pricePerExtraUser?: number;
  description?: string; sortOrder?: number;
}

const PLAN_TIERS = ['SMALL', 'MEDIUM', 'LARGE'];
const PLAN_TYPES = ['FULL', 'MODULE'];

function validatePlatformPlanInput(data: Partial<CreatePlanInput>) {
  if (data.tier !== undefined && !PLAN_TIERS.includes(String(data.tier))) {
    throw { status: 400, code: 'INVALID_TIER', message: '套餐等级无效' };
  }
  if (data.type !== undefined && !PLAN_TYPES.includes(String(data.type))) {
    throw { status: 400, code: 'INVALID_TYPE', message: '套餐类型无效' };
  }
  if (data.pricePerMonth !== undefined && Number(data.pricePerMonth) < 0) {
    throw { status: 400, code: 'INVALID_PRICE', message: '月费不能为负数' };
  }
  if (data.maxUsers !== undefined && Number(data.maxUsers) < 1) {
    throw { status: 400, code: 'INVALID_MAX_USERS', message: '最大用户数至少为 1' };
  }
  if (data.pricePerExtraUser !== undefined && Number(data.pricePerExtraUser) < 0) {
    throw { status: 400, code: 'INVALID_EXTRA_USER_PRICE', message: '额外用户费用不能为负数' };
  }
}

export const createPlan = (data: CreatePlanInput) => {
  validatePlatformPlanInput(data);
  return prisma.platformPlan.create({ data: { name: data.name, tier: data.tier || 'SMALL', type: data.type || 'FULL', modules: data.modules ? JSON.stringify(data.modules) : data.modules, pricePerMonth: data.pricePerMonth, maxUsers: data.maxUsers || 5, pricePerExtraUser: data.pricePerExtraUser || 0, description: data.description, sortOrder: data.sortOrder || 0 } });
};

export const updatePlan = (id: string, data: any) => {
  validatePlatformPlanInput(data);
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.tier !== undefined) updateData.tier = data.tier;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.modules !== undefined) updateData.modules = JSON.stringify(data.modules);
  if (data.pricePerMonth !== undefined) updateData.pricePerMonth = data.pricePerMonth;
  if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
  if (data.pricePerExtraUser !== undefined) updateData.pricePerExtraUser = data.pricePerExtraUser;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  return prisma.platformPlan.update({ where: { id }, data: updateData });
};

export const deletePlan = async (id: string) => {
  const existing = await prisma.platformPlan.findUnique({ where: { id } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '套餐不存在' };
  const activeSubscription = await prisma.subscription.findFirst({
    where: { plan: existing.type, tier: existing.tier },
    select: { id: true },
  });
  if (activeSubscription) {
    throw { status: 409, code: 'PLAN_HAS_SUBSCRIPTIONS', message: '该套餐已有企业订阅，请先迁移订阅后再删除' };
  }
  await prisma.platformPlan.delete({ where: { id } });
  return { planName: existing.name };
};

// ============================================
// 租户订阅
// ============================================

export async function getTenantSubscription(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, code: true } });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '企业不存在' };
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  return { tenant, subscription };
}

export async function updateTenantSubscription(tenantId: string, data: any) {
  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '该企业暂无订阅' };
  const updateData: any = {};
  if (data.plan !== undefined) updateData.plan = data.plan;
  if (data.tier !== undefined) updateData.tier = data.tier;
  if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
  if (data.pricePerMonth !== undefined) updateData.pricePerMonth = data.pricePerMonth;
  if (data.pricePerExtraUser !== undefined) updateData.pricePerExtraUser = data.pricePerExtraUser;
  if (data.status !== undefined) updateData.status = data.status;
  return prisma.subscription.update({ where: { tenantId }, data: updateData });
}

// ============================================
// 支付记录
// ============================================

export interface DevPaymentListParams {
  page: number; pageSize: number; tenantId?: string; status?: string; keyword?: string;
}
export async function listDeveloperPayments(params: DevPaymentListParams) {
  const { page, pageSize, tenantId, status, keyword } = params;
  const where: any = {};
  if (tenantId || keyword) {
    where.subscription = {};
    if (tenantId) where.subscription.tenantId = tenantId;
    if (keyword) {
      where.subscription.tenant = {
        OR: [
          { name: { contains: keyword } },
          { code: { contains: keyword } },
        ],
      };
    }
  }
  if (status) where.status = status;
  const [total, payments] = await Promise.all([
    prisma.subscriptionPayment.count({ where }),
    prisma.subscriptionPayment.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { subscription: { select: { tenant: { select: { id: true, name: true, code: true } } } } },
    }),
  ]);
  const formatted = payments.map((payment) => ({
    id: payment.id,
    subscriptionId: payment.subscriptionId,
    tenantId: payment.subscription?.tenant?.id,
    tenantName: payment.subscription?.tenant?.name || '-',
    tenantCode: payment.subscription?.tenant?.code || '',
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  }));
  return { payments: formatted, total, totalPages: Math.ceil(total / pageSize) };
}

// ============================================
// 发票管理
// ============================================

export interface InvoiceListParams { page: number; pageSize: number; }
export async function listInvoices(params: InvoiceListParams) {
  const { page, pageSize } = params;
  const [total, invoices] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.findMany({
      skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { id: true, name: true, code: true } } },
    }),
  ]);
  const formatted = invoices.map((invoice) => ({
    id: invoice.id,
    tenantId: invoice.tenantId,
    tenantName: invoice.tenant?.name || '-',
    tenantCode: invoice.tenant?.code || '',
    paymentId: invoice.paymentId,
    invoiceNo: invoice.invoiceNo,
    title: invoice.title,
    taxId: invoice.taxId,
    amount: invoice.amount,
    status: invoice.status,
    fileUrl: invoice.fileUrl,
    issuedAt: invoice.issuedAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  }));
  return { invoices: formatted, total, totalPages: Math.ceil(total / pageSize) };
}

export async function createInvoice(data: { tenantId: string; paymentId?: string; title: string; taxId?: string; amount: number }) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.invoice.count({ where: { createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) } } });
  const invoiceNo = `INV${dateStr}${String(count + 1).padStart(4, '0')}`;
  return prisma.invoice.create({ data: { tenantId: data.tenantId, paymentId: data.paymentId, invoiceNo, title: data.title, taxId: data.taxId, amount: data.amount } });
}

export async function issueInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw { status: 404, code: 'NOT_FOUND', message: '发票不存在' };
  if (invoice.status !== 'pending') throw { status: 400, code: 'INVALID_STATUS', message: '仅待开具的发票可以开具' };
  return prisma.invoice.update({ where: { id }, data: { status: 'issued', issuedAt: new Date() } });
}

// ============================================
// 存储管理
// ============================================

export async function getStorageStats(page: number, pageSize: number) {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { createdAt: 'desc' } });
  const tenantIds = tenants.map((t) => t.id);
  const attachmentGroups = await prisma.attachment.groupBy({ by: ['tenantId'], where: { tenantId: { in: tenantIds } }, _sum: { fileSize: true }, _count: { id: true } });
  const storageMap = new Map(attachmentGroups.map((g) => [g.tenantId, { size: g._sum.fileSize || 0, count: g._count.id }]));
  const total = tenants.length;
  const totalSize = attachmentGroups.reduce((sum, g) => sum + (g._sum.fileSize || 0), 0);
  const totalFiles = attachmentGroups.reduce((sum, g) => sum + g._count.id, 0);
  const paginated = tenants.slice((page - 1) * pageSize, page * pageSize);
  const stats = paginated.map((t) => ({ ...t, totalSize: storageMap.get(t.id)?.size || 0, fileCount: storageMap.get(t.id)?.count || 0 }));
  return { stats, total, totalPages: Math.ceil(total / pageSize), totalSize, totalFiles };
}

export async function getStorageFiles(page: number, pageSize: number) {
  const [total, files] = await Promise.all([
    prisma.attachment.count(),
    prisma.attachment.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { fileSize: 'desc' }, include: { tenant: { select: { id: true, name: true, code: true } } } }),
  ]);
  const formatted = files.map((file) => ({
    id: file.id,
    tenantId: file.tenantId,
    tenantName: file.tenant?.name || '-',
    tenantCode: file.tenant?.code || '',
    entityType: file.entityType,
    entityId: file.entityId,
    category: file.category,
    fileName: file.fileName,
    storedName: file.storedName,
    filePath: file.filePath,
    fileSize: file.fileSize || 0,
    mimeType: file.mimeType,
    createdAt: file.createdAt,
  }));
  return { files: formatted, total, totalPages: Math.ceil(total / pageSize) };
}

// ============================================
// API 密钥管理
// ============================================

export interface ApiKeyListParams { page: number; pageSize: number; tenantId?: string; }
export async function listApiKeys(params: ApiKeyListParams) {
  const { page, pageSize, tenantId } = params;
  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  const [total, keys] = await Promise.all([
    prisma.apiKey.count({ where }),
    prisma.apiKey.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' },
      select: { id: true, tenantId: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, isActive: true, createdAt: true, updatedAt: true },
    }),
  ]);
  return { keys, total, totalPages: Math.ceil(total / pageSize) };
}

export async function createApiKey(tenantId: string, name: string, expiresAt?: string) {
  const crypto = await import('crypto');
  const rawKey = `zlt_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const apiKey = await prisma.apiKey.create({ data: { tenantId, name, keyPrefix: rawKey.substring(0, 8), keyHash, expiresAt: expiresAt ? new Date(expiresAt) : null } });
  return { id: apiKey.id, tenantId, name, keyPrefix: apiKey.keyPrefix, expiresAt: apiKey.expiresAt, isActive: apiKey.isActive, rawKey };
}

export async function updateApiKey(id: string, data: { name?: string; isActive?: boolean; expiresAt?: string }) {
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: 'API密钥不存在' };
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  return prisma.apiKey.update({ where: { id }, data: updateData });
}

export const deleteApiKey = async (id: string) => {
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: 'API密钥不存在' };
  await prisma.apiKey.delete({ where: { id } });
  return { keyName: existing.name };
};

// ============================================
// 系统公告
// ============================================

export interface AnnouncementListParams { page: number; pageSize: number; }
export async function listAnnouncements(params: AnnouncementListParams) {
  const { page, pageSize } = params;
  const [total, announcements] = await Promise.all([
    prisma.announcement.count(),
    prisma.announcement.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
  ]);
  return { announcements, total, totalPages: Math.ceil(total / pageSize) };
}

export const createAnnouncement = (data: { title: string; content: string; type?: string }) =>
  prisma.announcement.create({
    data: {
      title: data.title,
      content: data.content,
      type: data.type || 'info',
      isPublished: true,
      publishedAt: new Date(),
    },
  });

export const updateAnnouncement = (id: string, data: { title?: string; content?: string; type?: string }) => {
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.type !== undefined) updateData.type = data.type;
  return prisma.announcement.update({ where: { id }, data: updateData });
};

export const deleteAnnouncement = async (id: string) => {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '公告不存在' };
  await prisma.announcement.delete({ where: { id } });
  return { title: existing.title };
};

export const publishAnnouncement = async (id: string) => {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '公告不存在' };
  const updated = await prisma.announcement.update({ where: { id }, data: { isPublished: !existing.isPublished, publishedAt: existing.isPublished ? null : new Date() } });
  return { updated, wasPublished: existing.isPublished, title: existing.title };
};

// ============================================
// 安全策略
// ============================================

export const SECURITY_KEYS = [
  'login_max_attempts', 'login_lockout_minutes', 'password_min_length',
  'password_require_special', 'session_timeout_minutes',
  'ip_whitelist_enabled', 'ip_whitelist',
];

export function getDefaultSecurityValue(key: string): string {
  const defaults: Record<string, string> = {
    login_max_attempts: '5', login_lockout_minutes: '30', password_min_length: '6',
    password_require_special: 'false', session_timeout_minutes: '1440',
    ip_whitelist_enabled: 'false', ip_whitelist: '',
  };
  return defaults[key] || '';
}

export async function getSecuritySettings() {
  const configs = await prisma.systemConfig.findMany({ where: { key: { in: SECURITY_KEYS } } });
  const settings: Record<string, string> = {};
  SECURITY_KEYS.forEach((key) => { settings[key] = configs.find((c) => c.key === key)?.value || getDefaultSecurityValue(key); });
  return settings;
}

export async function updateSecuritySettings(updates: Record<string, any>) {
  for (const key of Object.keys(updates)) {
    if (SECURITY_KEYS.includes(key) && updates[key] !== undefined) {
      await prisma.systemConfig.upsert({ where: { key }, update: { value: String(updates[key]) }, create: { key, value: String(updates[key]) } });
    }
  }
}

// ============================================
// 系统监控
// ============================================

export async function getMonitoring() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [onlineCount, hourlyCalls, dailyCalls, recentErrors, avgDuration] = await Promise.all([
    prisma.onlineSession.count({ where: { loggedOutAt: null } }),
    prisma.apiUsageLog.groupBy({ by: ['module'], where: { createdAt: { gte: oneHourAgo } }, _count: { id: true } }),
    prisma.apiUsageLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.apiUsageLog.count({ where: { createdAt: { gte: oneDayAgo }, status: { gte: 400 } } }),
    prisma.apiUsageLog.aggregate({ _avg: { duration: true }, where: { createdAt: { gte: oneDayAgo }, duration: { not: null } } }),
  ]);

  return {
    onlineUsers: onlineCount,
    hourlyApiCalls: hourlyCalls.reduce((sum, m) => sum + m._count.id, 0),
    apiCallsByModule: hourlyCalls,
    dailyApiCalls: dailyCalls,
    dailyErrors: recentErrors,
    avgResponseTime: Math.round(avgDuration._avg.duration || 0),
    uptime: process.uptime(),
  };
}

// ============================================
// 生产就绪自检
// ============================================

type ReadinessStatus = 'ready' | 'warning';

interface ReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string;
  detail?: Record<string, unknown>;
}

async function readinessQuery<T>(missingTables: string[], query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query();
  } catch (error: any) {
    if (error?.code === 'P2021') {
      const table = error?.meta?.table;
      if (typeof table === 'string' && !missingTables.includes(table)) missingTables.push(table);
      return fallback;
    }
    throw error;
  }
}

export async function getProductionReadiness() {
  const faceDiagnostic = getFaceProviderDiagnostic('http');
  const missingTables: string[] = [];

  const [
    activeTenants,
    enabledModuleEntitlements,
    portalDomains,
    defaultMiniPrograms,
    tenantMiniPrograms,
    enabledPhoneBindings,
    attendanceSettings,
  ] = await Promise.all([
    readinessQuery(missingTables, () => prisma.tenant.count({ where: { deletedAt: null, isActive: true } }), 0),
    readinessQuery(missingTables, () => prisma.tenantModuleEntitlement.groupBy({ by: ['moduleKey'], where: { isEnabled: true }, _count: { id: true } }), []),
    readinessQuery(missingTables, () => prisma.tenantPortalConfig.count({ where: { isEnabled: true, domain: { not: null } } }), 0),
    readinessQuery(missingTables, () => prisma.miniProgramConfig.count({ where: { isDefault: true, isEnabled: true } }), 0),
    readinessQuery(missingTables, () => prisma.miniProgramConfig.count({ where: { isDefault: false, tenantId: { not: null }, isEnabled: true } }), 0),
    readinessQuery(missingTables, () => prisma.miniProgramPhoneBinding.count({ where: { isEnabled: true } }), 0),
    readinessQuery(missingTables, () => prisma.attendanceSetting.groupBy({ by: ['faceProvider'], _count: { id: true } }), []),
  ]);

  const moduleCounts = Object.fromEntries(enabledModuleEntitlements.map((item) => [item.moduleKey, item._count.id]));
  const faceProviderCounts = Object.fromEntries(attendanceSettings.map((item) => [item.faceProvider, item._count.id]));
  const realFaceProviderTenantCount = attendanceSettings
    .filter((item) => item.faceProvider !== 'stub')
    .reduce((sum, item) => sum + item._count.id, 0);

  const checks: ReadinessCheck[] = [
    {
      key: 'database_schema',
      label: '数据库迁移状态',
      status: missingTables.length === 0 ? 'ready' : 'warning',
      message: missingTables.length === 0 ? '生产自检所需数据表可用' : '部分生产功能表缺失，请先执行数据库迁移',
      detail: { missingTables },
    },
    {
      key: 'active_tenants',
      label: '企业基础数据',
      status: activeTenants > 0 ? 'ready' : 'warning',
      message: activeTenants > 0 ? `已有 ${activeTenants} 个启用企业` : '尚无启用企业，无法进行生产业务验收',
      detail: { activeTenants },
    },
    {
      key: 'module_entitlements',
      label: '模块开通底座',
      status: enabledModuleEntitlements.length > 0 ? 'ready' : 'warning',
      message: enabledModuleEntitlements.length > 0 ? '已有企业模块开通记录' : '尚未发现模块开通记录，请为企业开通物资/劳资/财务模块',
      detail: { moduleCounts },
    },
    {
      key: 'independent_portal_domains',
      label: '独立登录域名',
      status: portalDomains > 0 ? 'ready' : 'warning',
      message: portalDomains > 0 ? `已有 ${portalDomains} 个启用的企业独立登录域名` : '尚无启用的企业独立登录域名；生产还需 DNS、反代和证书验证',
      detail: { enabledPortalDomains: portalDomains },
    },
    {
      key: 'mini_program_default',
      label: '默认小程序接入',
      status: defaultMiniPrograms > 0 ? 'ready' : 'warning',
      message: defaultMiniPrograms > 0 ? '开发者默认小程序已启用' : '尚未启用开发者默认小程序，未接入企业将无法走默认打卡入口',
      detail: { defaultMiniPrograms },
    },
    {
      key: 'mini_program_tenant_routing',
      label: '企业小程序与手机号分流',
      status: tenantMiniPrograms > 0 || enabledPhoneBindings > 0 ? 'ready' : 'warning',
      message: tenantMiniPrograms > 0 || enabledPhoneBindings > 0
        ? '已有企业自有小程序或默认小程序手机号预绑定'
        : '尚无企业自有小程序或手机号预绑定；同手机号多企业时仍需人工选择企业',
      detail: { tenantMiniPrograms, enabledPhoneBindings },
    },
    {
      key: 'face_gateway',
      label: '人脸识别 HTTP 网关',
      status: faceDiagnostic.ready ? 'ready' : 'warning',
      message: faceDiagnostic.ready
        ? '人脸识别 HTTP 网关环境变量已配置'
        : 'FACE_RECOGNITION_HTTP_ENDPOINT 未配置；生产人脸识别仍不可用',
      detail: {
        provider: faceDiagnostic.provider,
        endpointConfigured: faceDiagnostic.endpointConfigured,
        apiKeyConfigured: faceDiagnostic.apiKeyConfigured,
        threshold: faceDiagnostic.threshold,
        timeoutMs: faceDiagnostic.timeoutMs,
        faceProviderCounts,
        realFaceProviderTenantCount,
      },
    },
  ];

  return {
    overallStatus: checks.every((check) => check.status === 'ready') ? 'ready' : 'needs_attention',
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    checks,
  };
}
