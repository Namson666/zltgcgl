// ============================================
// 租户管理 - 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有 Prisma 操作和业务规则集中管理
// routes.ts 只负责 HTTP 请求/响应

import bcrypt from 'bcryptjs';
import { prisma } from '../../common/utils/prisma';

// ============================================
// 企业信息
// ============================================

export async function getTenantProfile(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) throw { status: 404, code: 'NOT_FOUND', message: '企业信息不存在' };
  return tenant;
}

export interface UpdateTenantProfileInput {
  name?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
}

export async function updateTenantProfile(tenantId: string, input: UpdateTenantProfileInput) {
  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.contactName !== undefined) updateData.contactName = input.contactName;
  if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
  if (input.address !== undefined) updateData.address = input.address;

  return prisma.tenant.update({ where: { id: tenantId }, data: updateData });
}

// ============================================
// 用户管理
// ============================================

export interface UserListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  search?: string;
  roleId?: string;
  departmentId?: string;
  isActive?: string;
}

export async function listUsers(params: UserListParams) {
  const { tenantId, page, pageSize, search, roleId, departmentId, isActive: isActiveFilter } = params;

  const where: any = { tenantId };
  if (search) where.OR = [{ username: { contains: search } }, { name: { contains: search } }];
  if (roleId) where.roleId = roleId;
  if (departmentId) where.departmentId = departmentId;
  if (isActiveFilter === 'true') where.isActive = true;
  else if (isActiveFilter === 'false') where.isActive = false;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        role: { select: { id: true, name: true, displayName: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    }),
  ]);

  const formattedUsers = users.map(({ passwordHash: _, ...user }) => user);
  return { users: formattedUsers, total, totalPages: Math.ceil(total / pageSize) };
}

export interface CreateUserInput {
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

export async function createUser(input: CreateUserInput) {
  const { tenantId, username, password, name, phone, email, roleId, departmentId, dataScope } = input;

  if (password.length < 6) throw { status: 400, code: 'WEAK_PASSWORD', message: '密码长度不能少于6位' };

  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw { status: 400, code: 'INVALID_ROLE', message: '指定的角色不存在' };

  const existingUser = await prisma.user.findUnique({ where: { tenantId_username: { tenantId, username } } });
  if (existingUser) throw { status: 409, code: 'DUPLICATE_USERNAME', message: '该用户名已存在' };

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { tenantId, departmentId: departmentId || null, username, passwordHash, name, phone, email, roleId, dataScope: dataScope || 'OWN_DEPARTMENT' },
    include: { role: { select: { id: true, name: true, displayName: true } } },
  });

  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  email?: string;
  roleId?: string;
  departmentId?: string;
  dataScope?: string;
}

export async function updateUser(tenantId: string, userId: string, input: UpdateUserInput) {
  const existingUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!existingUser) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在' };

  if (input.roleId) {
    const role = await prisma.role.findFirst({ where: { id: input.roleId, tenantId } });
    if (!role) throw { status: 400, code: 'INVALID_ROLE', message: '指定的角色不存在' };
  }

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.roleId !== undefined) updateData.roleId = input.roleId;
  if (input.departmentId !== undefined) updateData.departmentId = input.departmentId;
  if (input.dataScope !== undefined) updateData.dataScope = input.dataScope;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: {
      role: { select: { id: true, name: true, displayName: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  });

  const { passwordHash: _, ...userWithoutPassword } = updatedUser;
  return { oldName: existingUser.name, updated: userWithoutPassword };
}

export async function toggleUser(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在' };

  const updatedUser = await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  return { updated: updatedUser, wasActive: user.isActive, userName: user.name };
}

export async function resetUserPassword(tenantId: string, userId: string, newPassword: string) {
  if (newPassword.length < 6) throw { status: 400, code: 'WEAK_PASSWORD', message: '新密码长度不能少于6位' };

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在' };

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });
  return { userName: user.name };
}

// ============================================
// 角色权限管理
// ============================================

export async function listRoles(tenantId: string) {
  return prisma.role.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: { permissions: true, _count: { select: { users: true } } },
  });
}

const PERMISSION_FIELDS = [
  'canViewDashboard', 'canManageSystem', 'canViewLogs', 'canExport',
  'canViewInventory', 'canInbound', 'canOutbound', 'canReturn', 'canTransfer',
  'canViewRecords', 'canViewWorkTeamLedger',
  'canManagePersonnel', 'canManageAttendance', 'canManageSalary',
  'canManagePayment', 'canManageAnomaly', 'canManageReport',
  'canManageContract', 'canManageDepartment',
];

export async function updateRolePermissions(tenantId: string, roleId: string, body: Record<string, any>) {
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw { status: 404, code: 'NOT_FOUND', message: '指定的角色不存在' };

  const permissionData: any = {};
  for (const field of PERMISSION_FIELDS) {
    if (body[field] !== undefined) permissionData[field] = Boolean(body[field]);
  }

  const existing = await prisma.permission.findFirst({ where: { roleId } });
  const permission = await prisma.permission.upsert({
    where: { id: existing?.id || 'new' },
    update: permissionData,
    create: { roleId, ...permissionData },
  });

  return { role, permission, permissionData };
}

export async function createRole(tenantId: string, data: { name: string; displayName: string; description?: string }) {
  const existing = await prisma.role.findFirst({ where: { tenantId, name: data.name } });
  if (existing) throw { status: 409, code: 'ROLE_EXISTS', message: '角色标识已存在' };
  return prisma.role.create({
    data: { tenantId, name: data.name, displayName: data.displayName, description: data.description || null },
    include: { permissions: true, _count: { select: { users: true } } },
  });
}

export async function updateRole(tenantId: string, roleId: string, data: { name?: string; displayName?: string; description?: string }) {
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw { status: 404, code: 'NOT_FOUND', message: '指定的角色不存在' };
  if (data.name && data.name !== role.name) {
    const conflict = await prisma.role.findFirst({ where: { tenantId, name: data.name, id: { not: roleId } } });
    if (conflict) throw { status: 409, code: 'ROLE_EXISTS', message: '角色标识已存在' };
  }
  return prisma.role.update({
    where: { id: roleId },
    data: { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.displayName !== undefined ? { displayName: data.displayName } : {}), ...(data.description !== undefined ? { description: data.description } : {}) },
    include: { permissions: true, _count: { select: { users: true } } },
  });
}

export async function deleteRole(tenantId: string, roleId: string) {
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw { status: 404, code: 'NOT_FOUND', message: '指定的角色不存在' };
  if (role.isDefault) throw { status: 400, code: 'DEFAULT_ROLE', message: '不能删除系统预设角色' };
  const userCount = await prisma.user.count({ where: { roleId } });
  if (userCount > 0) throw { status: 400, code: 'HAS_USERS', message: `该角色下有 ${userCount} 个用户，请先转移用户后再删除` };
  await prisma.permission.deleteMany({ where: { roleId } });
  await prisma.role.delete({ where: { id: roleId } });
}

// ============================================
// 项目部管理（legacy - 保留用于 /api/tenants/departments 路由）
// ============================================

export interface TenantDeptListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: string;
}

export async function listTenantDepartments(params: TenantDeptListParams) {
  const { tenantId, page, pageSize, search, isActive: isActiveFilter } = params;

  const where: any = { tenantId };
  if (search) where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
  if (isActiveFilter === 'true') where.isActive = true;
  else if (isActiveFilter === 'false') where.isActive = false;

  const [total, departments] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        contract: { select: { id: true, name: true, type: true } },
        _count: { select: { subProjects: true, users: true } },
      },
    }),
  ]);

  return { departments, total, totalPages: Math.ceil(total / pageSize) };
}

export interface TenantCreateDeptInput {
  tenantId: string;
  name: string;
  code: string;
  contractId?: string;
  description?: string;
}

export async function createTenantDepartment(input: TenantCreateDeptInput) {
  const { tenantId, name, code, contractId, description } = input;

  if (contractId) {
    const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
    if (!contract) throw { status: 400, code: 'INVALID_CONTRACT', message: '指定的合同不存在' };
  }

  const existingDept = await prisma.department.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existingDept) throw { status: 409, code: 'DUPLICATE_CODE', message: '该项目部编号已存在' };

  return prisma.department.create({ data: { tenantId, contractId: contractId || null, name, code, description } });
}

export interface TenantUpdateDeptInput {
  name?: string;
  code?: string;
  contractId?: string;
  description?: string;
}

export async function updateTenantDepartment(tenantId: string, id: string, input: TenantUpdateDeptInput) {
  const existing = await prisma.department.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '指定的项目部不存在' };

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.contractId !== undefined) updateData.contractId = input.contractId;
  if (input.description !== undefined) updateData.description = input.description;

  const updated = await prisma.department.update({ where: { id }, data: updateData });
  return { oldName: existing.name, updated };
}

export async function toggleTenantDepartment(tenantId: string, id: string) {
  const department = await prisma.department.findFirst({ where: { id, tenantId } });
  if (!department) throw { status: 404, code: 'NOT_FOUND', message: '指定的项目部不存在' };

  const updated = await prisma.department.update({ where: { id }, data: { isActive: !department.isActive } });
  return { updated, wasActive: department.isActive, deptName: department.name };
}
