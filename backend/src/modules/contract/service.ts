// ============================================
// 合同管理 - 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有 Prisma 操作和业务规则集中管理
// routes.ts 只负责 HTTP 请求/响应
// ============================================

import { prisma } from '../../common/utils/prisma';
import { createLog, CreateLogInput } from '../../common/services/log.service';

// ============================================
// 合同 CRUD
// ============================================

export interface ContractListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  type?: string;
  search?: string;
  isActive?: 'true' | 'false';
}

export async function listContracts(params: ContractListParams) {
  const { tenantId, page, pageSize, type, search, isActive } = params;

  const where: any = { tenantId };

  if (type) {
    const validTypes = ['PROCUREMENT', 'CONSTRUCTION'];
    if (validTypes.includes(type)) where.type = type;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
    ];
  }

  if (isActive === 'true') where.isActive = true;
  else if (isActive === 'false') where.isActive = false;

  const [total, contracts] = await Promise.all([
    prisma.contract.count({ where }),
    prisma.contract.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { departments: true, progressPayments: true } },
      },
    }),
  ]);

  return { contracts, total, totalPages: Math.ceil(total / pageSize) };
}

export interface CreateContractInput {
  tenantId: string;
  type?: string;
  name: string;
  code?: string;
  totalAmount?: number;
  supplierId?: string;
  awardingParty?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export async function createContract(input: CreateContractInput) {
  const { tenantId, type, name, code, totalAmount, supplierId, awardingParty, description, startDate, endDate } = input;

  // 验证供应商
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) throw { status: 400, code: 'INVALID_SUPPLIER', message: '指定的供应商不存在' };
  }

  const contract = await prisma.contract.create({
    data: {
      tenantId,
      type: type || 'CONSTRUCTION',
      name,
      code: code || null,
      totalAmount: totalAmount ? parseFloat(String(totalAmount)) : null,
      supplierId: supplierId || null,
      awardingParty: awardingParty || null,
      description,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  return contract;
}

export async function getContractDetail(tenantId: string, id: string) {
  const contract = await prisma.contract.findFirst({
    where: { id, tenantId },
    include: {
      supplier: true,
      departments: { select: { id: true, name: true, code: true, isActive: true } },
      progressPayments: { orderBy: { receivedAt: 'desc' } },
    },
  });
  return contract;
}

export interface UpdateContractInput {
  name?: string;
  code?: string;
  totalAmount?: number | null;
  supplierId?: string;
  awardingParty?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

export async function updateContract(tenantId: string, id: string, input: UpdateContractInput) {
  const existing = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.totalAmount !== undefined) updateData.totalAmount = input.totalAmount !== null ? Number(input.totalAmount) : null;
  if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
  if (input.awardingParty !== undefined) updateData.awardingParty = input.awardingParty;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.startDate !== undefined) updateData.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) updateData.endDate = new Date(input.endDate);
  if (input.type !== undefined) updateData.type = input.type;

  const updated = await prisma.contract.update({ where: { id }, data: updateData });
  return { updated, oldName: existing.name };
}

export async function deleteContract(tenantId: string, id: string) {
  const contract = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!contract) return null;

  const updated = await prisma.contract.update({
    where: { id },
    data: { isActive: false },
  });
  return { updated, name: contract.name };
}

// ============================================
// 进度款管理
// ============================================

export async function listProgressPayments(tenantId: string, contractId: string) {
  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract) return { contract: null };

  const progressPayments = await prisma.progressPayment.findMany({
    where: { contractId, tenantId },
    orderBy: { receivedAt: 'desc' },
  });

  const totalAmount = progressPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    contract,
    payments: progressPayments,
    totalAmount,
    contractTotal: contract.totalAmount ? Number(contract.totalAmount) : 0,
  };
}

export interface CreateProgressPaymentInput {
  tenantId: string;
  contractId: string;
  amount: number;
  receivedAt: string;
  remark?: string;
}

export async function createProgressPayment(input: CreateProgressPaymentInput) {
  const { tenantId, contractId, amount, receivedAt, remark } = input;

  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract) return { contract: null };

  const payment = await prisma.progressPayment.create({
    data: {
      contractId,
      tenantId,
      amount: amount,
      receivedAt: new Date(receivedAt),
      remark,
    },
  });

  return { contract, payment };
}

// ============================================
// 日志记录（模块内统一调用）
// ============================================

export function makeLogInput(tenantId: string, userId: string | undefined, action: string, description: string, detail?: any, ip?: string, userAgent?: string): CreateLogInput {
  return { tenantId, userId, action, module: 'contract', description, detail, ip, userAgent };
}
