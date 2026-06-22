// ============================================
// 项目部管理 - 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有 Prisma 操作和业务规则集中管理
// routes.ts 只负责 HTTP 请求/响应

import { prisma } from '../../common/utils/prisma';
import { createLog } from '../../common/services/log.service';

// ============================================
// 项目部 CRUD
// ============================================

export interface DepartmentListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: string;
  contractId?: string;
}

export async function listDepartments(params: DepartmentListParams) {
  const { tenantId, page, pageSize, search, isActive, contractId } = params;

  const where: any = { tenantId };
  if (search) where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
  if (isActive === 'true') where.isActive = true;
  else if (isActive === 'false') where.isActive = false;
  if (contractId) where.contractId = contractId;

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

  const totalPages = Math.ceil(total / pageSize);
  return { departments, total, totalPages };
}

export interface CreateDepartmentInput {
  tenantId: string;
  name: string;
  code: string;
  contractId?: string;
  description?: string;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const { tenantId, name, code, contractId, description } = input;

  // 验证合同（如果指定了）
  if (contractId) {
    const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
    if (!contract) throw { status: 400, code: 'INVALID_CONTRACT', message: '指定的合同不存在' };
  }

  // 检查编号唯一性
  const existing = await prisma.department.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existing) throw { status: 409, code: 'DUPLICATE_CODE', message: '该项目部编号已存在' };

  return prisma.department.create({ data: { tenantId, contractId: contractId || null, name, code, description } });
}

export async function getDepartmentById(tenantId: string, id: string) {
  return prisma.department.findFirst({
    where: { id, tenantId },
    include: {
      contract: { select: { id: true, name: true, type: true, totalAmount: true } },
      subProjects: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
      users: {
        select: { id: true, username: true, name: true, role: { select: { name: true, displayName: true } } },
      },
    },
  });
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  contractId?: string;
  description?: string;
}

export async function updateDepartment(tenantId: string, id: string, input: UpdateDepartmentInput) {
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

export async function toggleDepartment(tenantId: string, id: string) {
  const department = await prisma.department.findFirst({ where: { id, tenantId } });
  if (!department) throw { status: 404, code: 'NOT_FOUND', message: '指定的项目部不存在' };

  const updated = await prisma.department.update({ where: { id }, data: { isActive: !department.isActive } });
  return { updated, wasActive: department.isActive, deptName: department.name };
}

// ============================================
// 子项目管理
// ============================================

export async function getSubProjects(tenantId: string, departmentId: string) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, tenantId } });
  if (!department) throw { status: 404, code: 'NOT_FOUND', message: '指定的项目部不存在' };

  return prisma.subProject.findMany({ where: { departmentId, tenantId }, orderBy: { createdAt: 'asc' } });
}

export interface CreateSubProjectInput {
  name: string;
  code?: string;
  description?: string;
}

export async function createSubProject(tenantId: string, departmentId: string, input: CreateSubProjectInput) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, tenantId } });
  if (!department) throw { status: 404, code: 'NOT_FOUND', message: '指定的项目部不存在' };

  return prisma.subProject.create({
    data: { tenantId, departmentId, name: input.name, code: input.code || null, description: input.description },
  });
}

export async function updateSubProject(
  tenantId: string, departmentId: string, subId: string,
  input: { name?: string; code?: string; description?: string; isActive?: boolean },
) {
  const existing = await prisma.subProject.findFirst({
    where: { id: subId, departmentId, tenantId },
  });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '指定的子项目不存在' };

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const updated = await prisma.subProject.update({ where: { id: subId }, data: updateData });
  return { oldName: existing.name, updated };
}

// ============================================
// 成员管理
// ============================================

export async function addMembers(tenantId: string, departmentId: string, userIds: string[]) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, tenantId } });
  if (!department) throw { status: 404, code: 'NOT_FOUND', message: '指定的项目部不存在' };

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds }, tenantId },
    data: { departmentId },
  });

  return { departmentName: department.name, updatedCount: result.count };
}

export async function removeMember(tenantId: string, departmentId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, departmentId } });
  if (!user) throw { status: 404, code: 'NOT_FOUND', message: '指定的用户不存在或不属于该项目部' };

  await prisma.user.update({ where: { id: userId }, data: { departmentId: null } });
  return { userName: user.name };
}
