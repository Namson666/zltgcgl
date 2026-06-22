// ============================================
// 合同管理 - 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有 Prisma 操作和业务规则集中管理
// routes.ts 只负责 HTTP 请求/响应
// ============================================

import { prisma } from '../../common/utils/prisma';
import { createLog, CreateLogInput } from '../../common/services/log.service';
import path from 'path';
import fs from 'fs';

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
        parentContract: { select: { id: true, name: true, code: true, totalAmount: true } },
        _count: { select: { departments: true, progressPayments: true, contractPayments: true } },
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
  parentContractId?: string;
  awardingParty?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export async function createContract(input: CreateContractInput) {
  const { tenantId, type, name, code, totalAmount, supplierId, parentContractId, awardingParty, description, startDate, endDate } = input;

  // 验证供应商
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) throw { status: 400, code: 'INVALID_SUPPLIER', message: '指定的供应商不存在' };
  }

  if (type === 'PROCUREMENT' && parentContractId) {
    const parent = await prisma.contract.findFirst({
      where: { id: parentContractId, tenantId, type: 'CONSTRUCTION', isActive: true },
    });
    if (!parent) throw { status: 400, code: 'INVALID_PARENT_CONTRACT', message: '关联的承包合同不存在' };
  }

  const contract = await prisma.contract.create({
    data: {
      tenantId,
      type: type || 'CONSTRUCTION',
      name,
      code: code || null,
      totalAmount: totalAmount ? parseFloat(String(totalAmount)) : null,
      supplierId: supplierId || null,
      parentContractId: type === 'PROCUREMENT' ? (parentContractId || null) : null,
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
      parentContract: { select: { id: true, name: true, code: true, totalAmount: true } },
      departments: { select: { id: true, name: true, code: true, isActive: true } },
      progressPayments: { orderBy: { receivedAt: 'desc' } },
      contractPayments: { orderBy: { paidAt: 'desc' } },
    },
  });
  return contract;
}

export interface UpdateContractInput {
  name?: string;
  code?: string;
  totalAmount?: number | null;
  supplierId?: string;
  parentContractId?: string | null;
  awardingParty?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

export async function updateContract(tenantId: string, id: string, input: UpdateContractInput) {
  const existing = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const nextType = input.type || existing.type;
  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.totalAmount !== undefined) updateData.totalAmount = input.totalAmount !== null ? Number(input.totalAmount) : null;
  if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
  if (input.parentContractId !== undefined) {
    if (nextType !== 'PROCUREMENT') {
      updateData.parentContractId = null;
    } else if (input.parentContractId) {
      const parent = await prisma.contract.findFirst({
        where: { id: input.parentContractId, tenantId, type: 'CONSTRUCTION', isActive: true },
      });
      if (!parent) throw { status: 400, code: 'INVALID_PARENT_CONTRACT', message: '关联的承包合同不存在' };
      updateData.parentContractId = input.parentContractId;
    } else {
      updateData.parentContractId = null;
    }
  } else if (nextType !== 'PROCUREMENT' && existing.parentContractId) {
    updateData.parentContractId = null;
  }
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
// 分包合同列表（合同基础板块入口）
// ============================================

export interface SubContractListParams {
  tenantId: string;
  contractId?: string;
  subcontractorId?: string;
  page: number;
  pageSize: number;
  search?: string;
}

export async function listSubContracts(params: SubContractListParams) {
  const { tenantId, contractId, subcontractorId, page, pageSize, search } = params;
  const skip = (page - 1) * pageSize;

  const where: any = { tenantId, isActive: true };
  if (contractId) where.contractId = contractId;
  if (subcontractorId) where.subcontractorId = subcontractorId;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { contract: { is: { name: { contains: search } } } },
      { subcontractor: { is: { companyName: { contains: search } } } },
      { subcontractor: { is: { contactName: { contains: search } } } },
    ];
  }

  const [contracts, total] = await Promise.all([
    prisma.subContract.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        contract: { select: { id: true, name: true, code: true, totalAmount: true } },
        workTeam: { select: { id: true, name: true, leaderName: true, phone: true } },
        subcontractor: { select: { id: true, companyName: true, contactName: true, type: true } },
        outputValues: { select: { amount: true, payableRatio: true } },
        subProgressPayments: { select: { totalAmount: true } },
      },
    }),
    prisma.subContract.count({ where }),
  ]);

  return { contracts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listWorkTeamsForContracts(tenantId: string) {
  return prisma.workTeam.findMany({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, leaderName: true, phone: true, memberCount: true },
  });
}

export interface CreateSubContractInput {
  tenantId: string;
  contractId: string;
  workTeamId: string;
  name: string;
  totalAmount?: number;
  description?: string;
}

async function resolveWorkTeamSubcontractor(tenantId: string, workTeamId: string) {
  const workTeam = await prisma.workTeam.findFirst({ where: { id: workTeamId, tenantId, isActive: true } });
  if (!workTeam) throw { status: 400, code: 'INVALID_WORK_TEAM', message: '关联的班组不存在' };

  const existing = await prisma.subcontractor.findFirst({
    where: {
      tenantId,
      type: 'WORK_TEAM',
      companyName: workTeam.name,
      contactPhone: workTeam.phone || undefined,
      isActive: true,
    },
  });
  if (existing) return { workTeam, subcontractor: existing };

  const subcontractor = await prisma.subcontractor.create({
    data: {
      tenantId,
      type: 'WORK_TEAM',
      companyName: workTeam.name,
      contactName: workTeam.leaderName || null,
      contactPhone: workTeam.phone || null,
      remark: '合同管理分包合同关联班组自动生成',
    },
  });
  return { workTeam, subcontractor };
}

async function assertConstructionContract(tenantId: string, contractId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId, type: 'CONSTRUCTION', isActive: true },
  });
  if (!contract) throw { status: 400, code: 'INVALID_PARENT_CONTRACT', message: '关联的承包合同不存在' };
  return contract;
}

export async function createSubContract(input: CreateSubContractInput) {
  const { tenantId, contractId, workTeamId, name, totalAmount, description } = input;
  await assertConstructionContract(tenantId, contractId);
  const { subcontractor } = await resolveWorkTeamSubcontractor(tenantId, workTeamId);

  return prisma.subContract.create({
    data: {
      tenantId,
      contractId,
      workTeamId,
      subcontractorId: subcontractor.id,
      name,
      totalAmount: totalAmount !== undefined ? Number(totalAmount) : null,
      description: description || null,
    },
    include: {
      contract: { select: { id: true, name: true, code: true, totalAmount: true } },
      workTeam: { select: { id: true, name: true, leaderName: true, phone: true } },
      subcontractor: { select: { id: true, companyName: true, contactName: true, type: true } },
    },
  });
}

export async function getSubContractDetail(tenantId: string, id: string) {
  return prisma.subContract.findFirst({
    where: { id, tenantId, isActive: true },
    include: {
      contract: { select: { id: true, name: true, code: true, totalAmount: true } },
      workTeam: { select: { id: true, name: true, leaderName: true, phone: true } },
      subcontractor: { select: { id: true, companyName: true, contactName: true, type: true } },
      subProgressPayments: { orderBy: { paidAt: 'desc' } },
    },
  });
}

export async function updateSubContract(tenantId: string, id: string, input: Partial<CreateSubContractInput>) {
  const existing = await prisma.subContract.findFirst({ where: { id, tenantId, isActive: true } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '分包合同不存在' };

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.totalAmount !== undefined) updateData.totalAmount = input.totalAmount !== null ? Number(input.totalAmount) : null;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.contractId !== undefined) {
    await assertConstructionContract(tenantId, input.contractId);
    updateData.contractId = input.contractId;
  }
  if (input.workTeamId !== undefined) {
    const { subcontractor } = await resolveWorkTeamSubcontractor(tenantId, input.workTeamId);
    updateData.workTeamId = input.workTeamId;
    updateData.subcontractorId = subcontractor.id;
  }

  return prisma.subContract.update({
    where: { id },
    data: updateData,
    include: {
      contract: { select: { id: true, name: true, code: true, totalAmount: true } },
      workTeam: { select: { id: true, name: true, leaderName: true, phone: true } },
      subcontractor: { select: { id: true, companyName: true, contactName: true, type: true } },
    },
  });
}

export async function deleteSubContract(tenantId: string, id: string) {
  const existing = await prisma.subContract.findFirst({ where: { id, tenantId, isActive: true } });
  if (!existing) throw { status: 404, code: 'NOT_FOUND', message: '分包合同不存在' };
  return prisma.subContract.update({ where: { id }, data: { isActive: false } });
}

// ============================================
// 合同附件管理
// ============================================

export async function assertContractExists(tenantId: string, contractId: string) {
  return prisma.contract.findFirst({ where: { id: contractId, tenantId } });
}

export async function assertSubContractExists(tenantId: string, subContractId: string) {
  return prisma.subContract.findFirst({ where: { id: subContractId, tenantId, isActive: true } });
}

export async function createContractAttachments(tenantId: string, contractId: string, files: Express.Multer.File[], category?: string) {
  const contract = await assertContractExists(tenantId, contractId);
  if (!contract) throw { status: 404, code: 'CONTRACT_NOT_FOUND', message: '合同不存在' };

  return prisma.$transaction(
    files.map(file =>
      prisma.attachment.create({
        data: {
          tenantId,
          fileName: file.originalname,
          storedName: file.filename,
          filePath: `/uploads/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
          entityType: 'contract',
          entityId: contractId,
          category: category || 'contract',
        },
      })
    )
  );
}

export async function listContractAttachments(tenantId: string, contractId: string, category?: string) {
  const contract = await assertContractExists(tenantId, contractId);
  if (!contract) throw { status: 404, code: 'CONTRACT_NOT_FOUND', message: '合同不存在' };

  return prisma.attachment.findMany({
    where: { tenantId, entityType: 'contract', entityId: contractId, ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getContractAttachment(tenantId: string, attachmentId: string) {
  return prisma.attachment.findFirst({
    where: { id: attachmentId, tenantId, entityType: 'contract' },
  });
}

export async function deleteContractAttachment(tenantId: string, attachmentId: string, uploadDir: string) {
  const attachment = await getContractAttachment(tenantId, attachmentId);
  if (!attachment) throw { status: 404, code: 'NOT_FOUND', message: '附件不存在' };

  const fullPath = path.join(uploadDir, attachment.storedName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  await prisma.attachment.delete({ where: { id: attachment.id } });
  return attachment;
}

export async function createSubContractAttachments(tenantId: string, subContractId: string, files: Express.Multer.File[], category?: string) {
  const subContract = await assertSubContractExists(tenantId, subContractId);
  if (!subContract) throw { status: 404, code: 'SUB_CONTRACT_NOT_FOUND', message: '分包合同不存在' };

  return prisma.$transaction(
    files.map(file =>
      prisma.attachment.create({
        data: {
          tenantId,
          fileName: file.originalname,
          storedName: file.filename,
          filePath: `/uploads/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
          entityType: 'sub_contract',
          entityId: subContractId,
          category: category || 'payment_voucher',
        },
      })
    )
  );
}

export async function listSubContractAttachments(tenantId: string, subContractId: string, category?: string) {
  const subContract = await assertSubContractExists(tenantId, subContractId);
  if (!subContract) throw { status: 404, code: 'SUB_CONTRACT_NOT_FOUND', message: '分包合同不存在' };

  return prisma.attachment.findMany({
    where: { tenantId, entityType: 'sub_contract', entityId: subContractId, ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getManagedAttachment(tenantId: string, attachmentId: string) {
  return prisma.attachment.findFirst({
    where: { id: attachmentId, tenantId, entityType: { in: ['contract', 'sub_contract'] } },
  });
}

export async function deleteManagedAttachment(tenantId: string, attachmentId: string, uploadDir: string) {
  const attachment = await getManagedAttachment(tenantId, attachmentId);
  if (!attachment) throw { status: 404, code: 'NOT_FOUND', message: '附件不存在' };

  const fullPath = path.join(uploadDir, attachment.storedName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  await prisma.attachment.delete({ where: { id: attachment.id } });
  return attachment;
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
// 采购合同付款记录
// ============================================

export async function listContractPayments(tenantId: string, contractId: string) {
  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId, type: 'PROCUREMENT' } });
  if (!contract) return { contract: null };

  const payments = await prisma.contractPayment.findMany({
    where: { contractId, tenantId },
    orderBy: { paidAt: 'desc' },
  });

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return { contract, payments, totalAmount, contractTotal: contract.totalAmount ? Number(contract.totalAmount) : 0 };
}

export interface CreateContractPaymentInput {
  tenantId: string;
  contractId: string;
  amount: number;
  paidAt: string;
  remark?: string;
}

export async function createContractPayment(input: CreateContractPaymentInput) {
  const { tenantId, contractId, amount, paidAt, remark } = input;
  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId, type: 'PROCUREMENT' } });
  if (!contract) return { contract: null };

  const payment = await prisma.contractPayment.create({
    data: { contractId, tenantId, amount: Number(amount), paidAt: new Date(paidAt), remark },
  });

  return { contract, payment };
}

// ============================================
// 分包合同付款记录
// ============================================

export async function listSubContractPayments(tenantId: string, subContractId: string) {
  const subContract = await assertSubContractExists(tenantId, subContractId);
  if (!subContract) return { subContract: null };

  const payments = await prisma.subProgressPayment.findMany({
    where: { subContractId, tenantId },
    orderBy: { paidAt: 'desc' },
  });
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  return { subContract, payments, totalAmount, contractTotal: subContract.totalAmount ? Number(subContract.totalAmount) : 0 };
}

export interface CreateSubContractPaymentInput {
  tenantId: string;
  subContractId: string;
  amount: number;
  paidAt: string;
  remark?: string;
}

export async function createSubContractPayment(input: CreateSubContractPaymentInput) {
  const { tenantId, subContractId, amount, paidAt, remark } = input;
  const subContract = await assertSubContractExists(tenantId, subContractId);
  if (!subContract) return { subContract: null };

  const payment = await prisma.subProgressPayment.create({
    data: {
      tenantId,
      subContractId,
      totalAmount: Number(amount),
      paidAt: new Date(paidAt),
      remark,
    },
  });

  return { subContract, payment };
}

// ============================================
// 日志记录（模块内统一调用）
// ============================================

export function makeLogInput(tenantId: string, userId: string | undefined, action: string, description: string, detail?: any, ip?: string, userAgent?: string): CreateLogInput {
  return { tenantId, userId, action, module: 'contract', description, detail, ip, userAgent };
}
