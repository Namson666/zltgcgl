// ============================================
// 物资管理（WMS）- 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有业务逻辑集中管理
// routes.ts 只负责 HTTP 请求/响应
// OCR 送货单识别代码保留在 routes.ts 中

import ExcelJS from 'exceljs';
import { prisma } from '../../common/utils/prisma';

// ============================================
// 辅助函数
// ============================================

export async function generateOrderNo(prefix: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const datePrefix = `${prefix}-${today}`;

  let lastOrder: { orderNo: string } | null = null;
  switch (prefix) {
    case 'IN':
      lastOrder = await prisma.inboundOrder.findFirst({
        where: { orderNo: { startsWith: datePrefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true },
      });
      break;
    case 'OUT':
      lastOrder = await prisma.outboundOrder.findFirst({
        where: { orderNo: { startsWith: datePrefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true },
      });
      break;
    case 'RET':
      lastOrder = await prisma.returnOrder.findFirst({
        where: { orderNo: { startsWith: datePrefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true },
      });
      break;
    case 'TRF':
      lastOrder = await prisma.transferOrder.findFirst({
        where: { orderNo: { startsWith: datePrefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true },
      });
      break;
    default:
      lastOrder = await prisma.inboundOrder.findFirst({
        where: { orderNo: { startsWith: datePrefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true },
      });
  }

  let seq = 1;
  if (lastOrder) {
    const parts = lastOrder.orderNo.split('-');
    seq = parseInt(parts[parts.length - 1]) + 1;
  }
  return `${datePrefix}-${String(seq).padStart(4, '0')}`;
}

export async function exportToExcel(rows: any[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName || 'Sheet1');

  if (rows && rows.length > 0) {
    const columns = Object.keys(rows[0]).map(key => ({
      header: key, key, width: Math.max(String(key).length * 2 + 4, 12),
    }));
    sheet.columns = columns;

    for (const row of rows) {
      const sheetRow: Record<string, any> = {};
      for (const col of columns) {
        let val = row[col.key];
        if (val instanceof Date) val = val.toLocaleString('zh-CN');
        sheetRow[col.key] = val ?? '';
      }
      sheet.addRow(sheetRow);
    }

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}

// ============================================
// 一、物资目录管理
// ============================================

export async function listMaterials(tenantId: string, filters?: { name?: string; code?: string }) {
  const where: any = { tenantId };
  if (filters?.name) where.name = { contains: filters.name, mode: 'insensitive' };
  if (filters?.code) where.code = { contains: filters.code, mode: 'insensitive' };
  return prisma.material.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export interface CreateMaterialData {
  tenantId: string;
  code?: string;
  name: string;
  unit: string;
  unitPrice?: number;
  category?: string;
}

export async function createMaterial(data: CreateMaterialData) {
  return prisma.material.create({
    data: {
      tenantId: data.tenantId, code: data.code || null, name: data.name,
      unit: data.unit, unitPrice: data.unitPrice || 0, category: data.category,
    },
  });
}

export async function updateMaterial(id: string, data: Partial<CreateMaterialData>) {
  return prisma.material.update({ where: { id }, data });
}

export async function deleteMaterial(id: string) {
  return prisma.material.delete({ where: { id } });
}

export async function getMaterialsExportData(tenantId: string) {
  const materials = await prisma.material.findMany({ where: { tenantId } });
  return {
    rows: materials.map(m => ({
      '物资编码': m.code, '物资名称': m.name, '单位': m.unit,
      '单价': m.unitPrice, '分类': m.category || '',
    })),
    count: materials.length,
  };
}

// ============================================
// 二、库存查询
// ============================================

export interface InventoryListParams {
  tenantId: string;
  status?: string;
  viewMode?: string;
  contractId?: string;
  contractIds?: string;
  departmentId?: string;
  departmentIds?: string;
  subProjectId?: string;
  projectCode?: string;
  projectName?: string;
  workTeamId?: string;
  materialName?: string;
  materialCode?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listInventory(params: InventoryListParams) {
  const { tenantId, status, viewMode, contractId, contractIds, departmentId, departmentIds, subProjectId, projectCode, projectName, workTeamId, materialName, materialCode, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  // 已出库物资查询模式
  if (status === 'out') {
    const where: any = { outboundOrder: { tenantId, isActive: true } };
    if (subProjectId) where.outboundOrder.subProjectId = subProjectId;
    else if (contractId) where.outboundOrder = { ...where.outboundOrder, subProject: { contractId } };
    if (projectCode) where.outboundOrder.subProject = { ...where.outboundOrder?.subProject, code: { contains: projectCode, mode: 'insensitive' } };
    if (workTeamId) where.outboundOrder.workTeamId = workTeamId;
    if (materialName) where.material = { name: { contains: materialName, mode: 'insensitive' } };
    if (materialCode) where.material = { ...where.material, code: { contains: materialCode, mode: 'insensitive' } };
    if (startDate || endDate) {
      where.outboundOrder.outboundDate = {};
      if (startDate) where.outboundOrder.outboundDate.gte = new Date(startDate);
      if (endDate) where.outboundOrder.outboundDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.outboundItem.findMany({
        where, skip, take: pageSize,
        include: { material: true, outboundOrder: { include: { subProject: { include: { department: { include: { contract: true } } } } } } },
        orderBy: { outboundOrder: { createdAt: 'desc' } },
      }),
      prisma.outboundItem.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // 在库物资明细模式
  if (status === 'in' && viewMode === 'detail') {
    const where: any = { inboundOrder: { tenantId } };
    if (subProjectId) where.inboundOrder.subProjectId = subProjectId;
    else if (contractId) where.inboundOrder = { ...where.inboundOrder, subProject: { contractId } };
    if (materialName) where.material = { name: { contains: materialName, mode: 'insensitive' } };
    if (materialCode) where.material = { ...where.material, code: { contains: materialCode, mode: 'insensitive' } };
    if (startDate || endDate) {
      where.inboundOrder.inboundDate = {};
      if (startDate) where.inboundOrder.inboundDate.gte = new Date(startDate);
      if (endDate) where.inboundOrder.inboundDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.inboundItem.findMany({
        where, skip, take: pageSize,
        include: { material: true, inboundOrder: { include: { subProject: { include: { department: { include: { contract: true } } } } } } },
        orderBy: { inboundOrder: { inboundDate: 'desc' } },
      }),
      prisma.inboundItem.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // 在库物资查询模式（默认）
  // 使用 AND 数组结构，使每个筛选条件独立，合同过滤可通过 subProject 和 department 双路径
  const andConditions: any[] = [
    { material: { tenantId } },
    { isActive: true },
    { quantity: { gt: 0 } },
  ];

  // 按项目部过滤
  if (departmentIds) {
    const ids = departmentIds.split(',').filter(Boolean);
    andConditions.push(ids.length === 1 ? { departmentId: ids[0] } : { departmentId: { in: ids } });
  } else if (departmentId) {
    andConditions.push({ departmentId });
  }

  // 按合同过滤 —— 通过 subProject.department 和直接 department 两条路径搜索
  if (contractIds) {
    const ids = contractIds.split(',').filter(Boolean);
    const contractIn = ids.length === 1 ? ids[0] : { in: ids };
    andConditions.push({
      OR: [
        { subProject: { department: { contractId: contractIn } } },
        { department: { contractId: contractIn } },
      ],
    });
  } else if (contractId) {
    andConditions.push({
      OR: [
        { subProject: { department: { contractId } } },
        { department: { contractId } },
      ],
    });
  }

  if (subProjectId) andConditions.push({ subProjectId });
  if (projectCode) andConditions.push({ department: { code: { contains: projectCode, mode: 'insensitive' } } });
  if (materialName) andConditions.push({ material: { name: { contains: materialName, mode: 'insensitive' } } });
  if (materialCode) andConditions.push({ material: { code: { contains: materialCode, mode: 'insensitive' } } });
  if (projectName) andConditions.push({ projectName });

  const where: any = { AND: andConditions };

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where, skip, take: pageSize,
      include: { material: true, subProject: { include: { department: { include: { contract: true } } } }, department: { include: { contract: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.inventory.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getInventoryExportData(tenantId: string, subProjectId?: string) {
  const where: any = { material: { tenantId } };
  if (subProjectId) where.subProjectId = subProjectId;

  const items = await prisma.inventory.findMany({ where, include: { material: true, subProject: true } });
  const rows = items.map(inv => ({
    '子项目名称': inv.subProject?.name || '', '子项目编码': inv.subProject?.code || '',
    '项目名称': inv.projectName || '待分配', '物资名称': inv.material.name,
    '物资编码': inv.material.code, '单位': inv.material.unit,
    '在库数量': inv.quantity, '已出库数量': inv.outQuantity,
    '单价': inv.material.unitPrice,
  }));
  return { rows, count: items.length };
}

export async function getInventoryProjectNames(tenantId: string, contractId?: string, departmentId?: string) {
  const where: any = { tenantId, isActive: true, projectName: { not: null }, quantity: { gt: 0 } };
  if (departmentId) {
    const ids = departmentId.split(',').filter(Boolean);
    if (ids.length === 1) where.departmentId = ids[0];
    else if (ids.length > 1) where.departmentId = { in: ids };
  }
  if (contractId) where.department = { contractId };

  const invRecords = await prisma.inventory.findMany({
    where, select: { projectName: true, subProjectId: true }, distinct: ['projectName', 'subProjectId'],
  });

  return invRecords.filter(r => r.projectName).map(r => ({ projectName: r.projectName!, subProjectId: r.subProjectId }));
}

// ============================================
// 三、送货单管理（不含OCR，OCR在routes.ts中）
// ============================================

export interface DeliveryOrderListParams {
  tenantId: string;
  contractId?: string;
  supplierId?: string;
  subProjectId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listDeliveryOrders(params: DeliveryOrderListParams) {
  const { tenantId, contractId, supplierId, subProjectId, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const where: any = { tenantId };
  if (contractId) where.contractId = contractId;
  if (supplierId) where.supplierId = supplierId;
  if (subProjectId) where.subProjectId = subProjectId;
  if (startDate || endDate) {
    where.deliveryDate = {};
    if (startDate) where.deliveryDate.gte = new Date(startDate);
    if (endDate) where.deliveryDate.lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { contract: { select: { id: true, name: true } }, supplier: true, items: true },
    }),
    prisma.deliveryOrder.count({ where }),
  ]);
  return { orders, total, page, pageSize };
}

export async function getDeliveryOrderById(tenantId: string, id: string) {
  const order = await prisma.deliveryOrder.findFirst({
    where: { id, tenantId },
    include: { contract: true, supplier: true, items: { include: { material: true } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '送货单不存在' };
  return order;
}

// ============================================
// 四、入库管理
// ============================================

export interface InboundListParams {
  tenantId: string;
  contractId?: string;
  supplierId?: string;
  subProjectId?: string;
  materialName?: string;
  source?: string;
  orderNo?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listInboundOrders(params: InboundListParams) {
  const { tenantId, contractId, supplierId, subProjectId, materialName, source, orderNo, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const where: any = { tenantId, isActive: true };
  if (subProjectId) where.subProjectId = subProjectId;
  else if (contractId) where.subProject = { contractId };
  if (source) where.source = source;
  if (orderNo) where.orderNo = { contains: orderNo, mode: 'insensitive' };
  if (materialName) where.items = { some: { material: { name: { contains: materialName, mode: 'insensitive' } } } };
  if (supplierId) where.supplierId = supplierId;
  if (startDate || endDate) {
    where.inboundDate = {};
    if (startDate) where.inboundDate.gte = new Date(startDate);
    if (endDate) where.inboundDate.lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    prisma.inboundOrder.findMany({
      where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
      include: {
        contract: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        subProject: { include: { department: { include: { contract: { select: { id: true, name: true } } } } } },
        items: { include: { material: true } }, creator: { select: { name: true } },
      },
    }),
    prisma.inboundOrder.count({ where }),
  ]);
  return { orders, total, page, pageSize };
}

export async function getInboundOrderById(tenantId: string, id: string) {
  const order = await prisma.inboundOrder.findFirst({
    where: { id, tenantId },
    include: {
      subProject: { include: { department: { include: { contract: { select: { id: true, name: true } } } } } },
      items: { include: { material: true } }, creator: { select: { name: true } },
    },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '入库单不存在' };
  return order;
}

export interface CreateManualInboundData {
  tenantId: string;
  userId?: string;
  subProjectId?: string;
  inboundDate?: string;
  remark?: string;
  items: Array<{
    materialName: string;
    projectName?: string;
    unit: string;
    quantity: number;
    unitPrice?: number;
    supplierName?: string;
    deliveryNo?: string;
    spec?: string;
  }>;
}

export async function createManualInbound(data: CreateManualInboundData) {
  const orderNo = await generateOrderNo('IN');
  return prisma.$transaction(async (tx) => {
    // Resolve material IDs from names, auto-create if not found
    const resolvedItems = await Promise.all(data.items.map(async (item) => {
      let material = await tx.material.findFirst({ where: { tenantId: data.tenantId, name: item.materialName } });
      if (!material) {
        material = await tx.material.create({ data: { tenantId: data.tenantId, name: item.materialName, unit: item.unit || '个', unitPrice: item.unitPrice || 0, spec: item.spec || null } });
      }
      return { ...item, materialId: material.id };
    }));

    // Resolve departmentId from subProject if not provided
    const contractId = (data as any).contractId || null;
    let departmentId: string | null = (data as any).departmentId || null;
    if (!departmentId && data.subProjectId) {
      const sp = await tx.subProject.findUnique({ where: { id: data.subProjectId }, select: { departmentId: true } });
      departmentId = sp?.departmentId || null;
    }

    let resolvedSubProjectId = data.subProjectId || null;
    if (!resolvedSubProjectId && departmentId) {
      const firstProjectName = resolvedItems.find(item => item.projectName?.trim())?.projectName?.trim();
      if (firstProjectName) {
        const existingSubProject = await tx.subProject.findFirst({
          where: { tenantId: data.tenantId, departmentId, name: firstProjectName, isActive: true },
        });
        const subProject = existingSubProject || await tx.subProject.create({
          data: { tenantId: data.tenantId, departmentId, name: firstProjectName, code: null, description: '由手动入库项目名称自动创建' },
        });
        resolvedSubProjectId = subProject.id;
      }
    }

    const order = await (tx.inboundOrder as any).create({
      data: {
        tenantId: data.tenantId, orderNo,
        subProjectId: resolvedSubProjectId,
        contractId,
        departmentId,
        supplierName: (data as any).supplierName || null,
        inboundDate: data.inboundDate ? new Date(data.inboundDate) : new Date(),
        source: 'manual', createdBy: data.userId || null, remark: data.remark || null,
      },
    });
    for (const item of resolvedItems) {
      await tx.inboundItem.create({
        data: {
          inboundOrderId: order.id,
          materialId: item.materialId!,
          projectName: item.projectName || '待分配物资',
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
        },
      });
    }

    for (const item of resolvedItems) {
      if (item.materialId) {
        const projectName = item.projectName || '待分配物资';
        const spId = resolvedSubProjectId;
        const existing = await tx.inventory.findFirst({
          where: { subProjectId: spId, materialId: item.materialId, projectName },
        });
        if (existing) {
          await tx.inventory.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.inventory.create({
            data: { tenantId: data.tenantId, departmentId, subProjectId: spId, materialId: item.materialId, projectName, quantity: item.quantity, outQuantity: 0 },
          });
        }
      }
    }
    return order;
  });
}

export interface CreateExcelInboundData {
  tenantId: string;
  userId?: string;
  subProjectId?: string;
  inboundDate?: string;
  remark?: string;
  items: Array<{
    materialName: string;
    projectName?: string;
    unit: string;
    quantity: number;
    unitPrice?: number;
    supplierName?: string;
    deliveryNo?: string;
    spec?: string;
  }>;
}

export async function createExcelInbound(data: CreateExcelInboundData) {
  const orderNo = await generateOrderNo('IN');
  return prisma.$transaction(async (tx) => {
    // Resolve material IDs from names, auto-create if not found
    const resolvedItems = await Promise.all(data.items.map(async (item) => {
      let material = await tx.material.findFirst({ where: { tenantId: data.tenantId, name: item.materialName } });
      if (!material) {
        material = await tx.material.create({ data: { tenantId: data.tenantId, name: item.materialName, unit: item.unit || '个', unitPrice: item.unitPrice || 0, spec: item.spec || null } });
      }
      return { ...item, materialId: material.id };
    }));

    // Resolve departmentId from subProject if available
    let departmentId: string | null = null;
    if (data.subProjectId) {
      const sp = await tx.subProject.findUnique({ where: { id: data.subProjectId }, select: { departmentId: true } });
      departmentId = sp?.departmentId || null;
    }

    // Create order first (without items), then create items separately
    // to avoid Prisma nested-create foreign key validation issue with just-created materials
    const order = await tx.inboundOrder.create({
      data: {
        tenantId: data.tenantId, orderNo, subProjectId: data.subProjectId,
        inboundDate: data.inboundDate ? new Date(data.inboundDate) : new Date(),
        source: 'excel', createdBy: data.userId || undefined, remark: data.remark,
      },
    });
    for (const item of resolvedItems) {
      await tx.inboundItem.create({
        data: {
          inboundOrderId: order.id,
          materialId: item.materialId!,
          projectName: item.projectName || '待分配物资',
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
        },
      });
    }

    for (const item of resolvedItems) {
      if (item.materialId) {
        const projectName = item.projectName || '待分配物资';
        const spId = data.subProjectId || null;
        const existing = await tx.inventory.findFirst({
          where: { subProjectId: spId, materialId: item.materialId, projectName },
        });
        if (existing) {
          await tx.inventory.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.inventory.create({
            data: { tenantId: data.tenantId, departmentId, subProjectId: spId, materialId: item.materialId, projectName, quantity: item.quantity, outQuantity: 0 },
          });
        }
      }
    }
    return order;
  });
}

export async function getInboundCascadePreview(tenantId: string, id: string) {
  const order = await prisma.inboundOrder.findFirst({
    where: { id, tenantId, isActive: true },
    include: { items: { include: { material: true } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '入库单不存在' };

  const relatedOutbounds: any[] = [];
  const affectedInventory: any[] = [];
  for (const item of order.items) {
    if (!item.materialId || !order.subProjectId) continue;
    const outItems = await prisma.outboundItem.findMany({
      where: { materialId: item.materialId, outboundOrder: { subProjectId: order.subProjectId, tenantId, isActive: true } },
      include: { outboundOrder: true, material: { select: { name: true } } },
    });
    for (const oi of outItems) {
      if (!relatedOutbounds.find(r => r.id === oi.outboundOrderId)) {
        relatedOutbounds.push({ id: oi.outboundOrderId, orderNo: oi.outboundOrder.orderNo, outboundDate: oi.outboundOrder.outboundDate, workTeamName: oi.outboundOrder.workTeamName, itemCount: outItems.length });
      }
    }
    const inv = await prisma.inventory.findFirst({
      where: { subProjectId: order.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' },
      include: { material: { select: { name: true } } },
    });
    if (inv) affectedInventory.push({ materialName: inv.material?.name || item.material?.name, quantity: inv.quantity, projectName: item.projectName, change: -item.quantity });
  }
  return { order: { id: order.id, orderNo: order.orderNo, itemCount: order.items.length }, relatedOutbounds, affectedInventory };
}

export async function getOutboundCascadePreview(tenantId: string, id: string) {
  const order = await prisma.outboundOrder.findFirst({
    where: { id, tenantId, isActive: true },
    include: { items: { include: { material: true } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '出库单不存在' };

  const relatedReturns = await prisma.returnOrder.findMany({
    where: { outboundOrderId: id, isActive: true },
    select: { id: true, orderNo: true, returnDate: true },
  });
  const affectedInventory: any[] = [];
  for (const item of order.items) {
    const inv = await prisma.inventory.findFirst({
      where: { subProjectId: order.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' },
      include: { material: { select: { name: true } } },
    });
    affectedInventory.push({
      materialName: inv?.material?.name || item.material?.name || '—',
      quantity: inv?.quantity || 0,
      projectName: item.projectName,
      change: item.quantity, // 恢复库存
    });
  }
  return { order: { id: order.id, orderNo: order.orderNo, itemCount: order.items.length }, relatedReturns, affectedInventory };
}

export async function getReturnCascadePreview(tenantId: string, id: string) {
  const order = await prisma.returnOrder.findFirst({
    where: { id, tenantId, isActive: true },
    include: { items: { include: { material: true, outboundItem: { select: { projectName: true } } } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '退库单不存在' };

  const affectedInventory: any[] = [];
  for (const item of order.items) {
    const projectName = item.outboundItem?.projectName || null;
    const inv = await prisma.inventory.findFirst({
      where: { subProjectId: order.subProjectId, materialId: item.materialId, projectName },
      include: { material: { select: { name: true } } },
    });
    affectedInventory.push({
      materialName: inv?.material?.name || item.material?.name || '—',
      quantity: inv?.quantity || 0,
      projectName,
      change: -item.quantity, // 扣回库存
    });
  }
  return { order: { id: order.id, orderNo: order.orderNo, itemCount: order.items.length }, affectedInventory };
}

export async function getTransferCascadePreview(tenantId: string, id: string) {
  const order = await prisma.transferOrder.findFirst({
    where: { id, tenantId, isActive: true },
    include: { items: { include: { material: true } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '调拨单不存在' };

  const affectedInventory: any[] = [];
  for (const item of order.items) {
    // 调出方
    if (order.fromSubProjectId) {
      const fromInv = await prisma.inventory.findFirst({
        where: { subProjectId: order.fromSubProjectId, materialId: item.materialId },
        include: { material: { select: { name: true } } },
      });
      affectedInventory.push({
        side: '调出方',
        materialName: fromInv?.material?.name || item.material?.name || '—',
        quantity: fromInv?.quantity || 0,
        change: item.quantity, // 恢复库存
      });
    }
    // 调入方
    if (order.toSubProjectId) {
      const toInv = await prisma.inventory.findFirst({
        where: { subProjectId: order.toSubProjectId, materialId: item.materialId },
        include: { material: { select: { name: true } } },
      });
      affectedInventory.push({
        side: '调入方',
        materialName: toInv?.material?.name || item.material?.name || '—',
        quantity: toInv?.quantity || 0,
        change: -item.quantity, // 扣回库存
      });
    }
  }
  return { order: { id: order.id, orderNo: order.orderNo, itemCount: order.items.length }, affectedInventory };
}

export async function deleteInboundOrder(tenantId: string, id: string) {
  const order = await prisma.inboundOrder.findFirst({
    where: { id, tenantId },
    include: { items: { include: { material: true } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '入库单不存在' };

  await prisma.$transaction(async (tx) => {
    const subProjectId = order.subProjectId || null;
    const departmentId = order.departmentId || null;

    // 查找并软删除关联的出库单（按 subProjectId 或 departmentId + projectName 匹配）
    const relatedOutbounds: string[] = [];
    for (const item of order.items) {
      if (!item.materialId) continue;
      const outWhere: any = {
        materialId: item.materialId,
        outboundOrder: { tenantId, isActive: true },
      };
      if (subProjectId) outWhere.outboundOrder.subProjectId = subProjectId;
      const outItems = await tx.outboundItem.findMany({
        where: outWhere,
        select: { outboundOrderId: true, quantity: true, projectName: true },
      });
      for (const oi of outItems) {
        if (!relatedOutbounds.includes(oi.outboundOrderId)) {
          relatedOutbounds.push(oi.outboundOrderId);
        }
      }
    }

    for (const outId of relatedOutbounds) {
      const outOrder = await tx.outboundOrder.findFirst({
        where: { id: outId },
        include: { items: true },
      });
      if (!outOrder) continue;
      const outSpId = outOrder.subProjectId || null;
      for (const oi of outOrder.items) {
        const inv = await tx.inventory.findFirst({
          where: { subProjectId: outSpId, materialId: oi.materialId, projectName: oi.projectName || null },
        });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { increment: oi.quantity }, outQuantity: { decrement: oi.quantity } },
          });
        } else {
          await tx.inventory.create({
            data: { tenantId, subProjectId: outSpId, materialId: oi.materialId, projectName: oi.projectName || null, quantity: oi.quantity, outQuantity: 0 },
          });
        }
      }
      await tx.outboundOrder.update({ where: { id: outId }, data: { isActive: false } });
    }

    // 入库本身的库存回退
    for (const item of order.items) {
      if (!item.materialId) continue;
      const inv = await tx.inventory.findFirst({
        where: { subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' },
      });
      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity } },
        });
        // 库存归零且无其他活跃入库单 → 标记为不活跃
        const updatedInv = await tx.inventory.findUnique({ where: { id: inv.id } });
        if (updatedInv && updatedInv.quantity <= 0) {
          const otherWhere: any = {
            materialId: item.materialId,
            inboundOrder: { tenantId, isActive: true },
            projectName: item.projectName || '待分配物资',
          };
          if (subProjectId) otherWhere.inboundOrder.subProjectId = subProjectId;
          const otherInboundItems = await tx.inboundItem.count({ where: otherWhere });
          if (otherInboundItems === 0) {
            await tx.inventory.update({ where: { id: inv.id }, data: { isActive: false } });
          }
        }
      }
    }
    await tx.inboundOrder.update({ where: { id }, data: { isActive: false } });
  });
}

export async function deleteReturnOrder(tenantId: string, id: string) {
  const order = await prisma.returnOrder.findFirst({
    where: { id, tenantId },
    include: { items: { include: { outboundItem: { select: { projectName: true } } } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '退库单不存在' };

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.materialId || !order.subProjectId) continue;
      const projectName = item.outboundItem?.projectName || null;
      // 退库时增加了库存，删除时需要扣回
      const inv = await tx.inventory.findFirst({
        where: { subProjectId: order.subProjectId, materialId: item.materialId, projectName },
      });
      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity } },
        });
      }
    }
    await tx.returnOrder.update({ where: { id }, data: { isActive: false } });
  });
}

export async function deleteTransferOrder(tenantId: string, id: string) {
  const order = await prisma.transferOrder.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '调拨单不存在' };

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.materialId) continue;
      // 调出方：恢复库存（按 materialId + subProjectId 匹配，不限定 projectName）
      if (order.fromSubProjectId) {
        const fromInvs = await tx.inventory.findMany({
          where: { subProjectId: order.fromSubProjectId, materialId: item.materialId, quantity: { gte: 0 } },
        });
        let remaining = item.quantity;
        for (const inv of fromInvs) {
          if (remaining <= 0) break;
          const addBack = Math.min(remaining, item.quantity);
          await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: addBack } } });
          remaining -= addBack;
        }
      }
      // 调入方：扣回库存
      if (order.toSubProjectId) {
        const toInvs = await tx.inventory.findMany({
          where: { subProjectId: order.toSubProjectId, materialId: item.materialId, quantity: { gte: 0 } },
        });
        let remaining = item.quantity;
        for (const inv of toInvs) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, inv.quantity);
          await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: deduct } } });
          remaining -= deduct;
        }
      }
    }
    await tx.transferOrder.update({ where: { id }, data: { isActive: false } });
  });
}

export async function updateInboundOrder(tenantId: string, id: string, data: {
  subProjectId?: string;
  inboundDate?: string;
  remark?: string;
  items?: Array<{ id?: string; materialName: string; materialId?: string; projectName?: string; unit: string; quantity: number; unitPrice?: number; supplierName?: string; deliveryNo?: string; spec?: string }>;
}) {
  const order = await prisma.inboundOrder.findFirst({
    where: { id, tenantId },
    include: { items: { include: { material: true } } },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '入库单不存在' };

  return prisma.$transaction(async (tx) => {
    const subProjectId = data.subProjectId || order.subProjectId;

    // 回退旧库存
    for (const item of order.items) {
      if (item.materialId && order.subProjectId) {
        const inv = await tx.inventory.findFirst({
          where: { subProjectId: order.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' },
        });
        if (inv) {
          await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: item.quantity } } });
        }
      }
    }

    // 删除旧明细
    await tx.inboundItem.deleteMany({ where: { inboundOrderId: id } });

    // 重建明细和库存
    const updatedItems = data.items || [];
    for (const item of updatedItems) {
      if (!item.materialId) {
        let material = await tx.material.findFirst({ where: { tenantId, name: item.materialName } });
        if (!material) {
          material = await tx.material.create({ data: { tenantId, name: item.materialName, unit: item.unit || '个', unitPrice: item.unitPrice || 0, spec: item.spec || null } });
        }
        item.materialId = material.id;
      }
      if (item.materialId && subProjectId) {
        await tx.inventory.upsert({
          where: { subProjectId_materialId_projectName: { subProjectId: subProjectId!, materialId: item.materialId, projectName: item.projectName || '待分配物资' } },
          create: { tenantId, subProjectId: subProjectId!, materialId: item.materialId, projectName: item.projectName || '待分配物资', quantity: item.quantity, outQuantity: 0 },
          update: { quantity: { increment: item.quantity } },
        });
      }
    }

    // Update order fields first (without items), then create items separately
    // to avoid Prisma nested-create foreign key validation issue with just-created materials
    const updated = await tx.inboundOrder.update({
      where: { id },
      data: {
        subProjectId: data.subProjectId,
        inboundDate: data.inboundDate ? new Date(data.inboundDate) : undefined,
        remark: data.remark,
      },
    });

    for (const item of updatedItems) {
      await tx.inboundItem.create({
        data: {
          inboundOrderId: id,
          materialId: item.materialId!,
          projectName: item.projectName || '待分配物资',
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
        },
      });
    }
    return updated;
  });
}

// ============================================
// 五、出库管理
// ============================================

export interface OutboundListParams {
  tenantId: string;
  subProjectId?: string;
  workTeamId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listOutboundOrders(params: OutboundListParams) {
  const { tenantId, subProjectId, workTeamId, keyword, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const where: any = { tenantId, isActive: true };
  if (subProjectId) where.subProjectId = subProjectId;
  if (workTeamId) where.workTeamId = workTeamId;
  if (startDate || endDate) {
    where.outboundDate = {};
    if (startDate) where.outboundDate.gte = new Date(startDate);
    if (endDate) where.outboundDate.lte = new Date(endDate);
  }
  if (keyword) {
    where.items = { some: { material: { name: { contains: keyword, mode: 'insensitive' } } } };
  }

  const [orders, total] = await Promise.all([
    prisma.outboundOrder.findMany({
      where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
      include: {
        subProject: { include: { department: { include: { contract: { select: { id: true, name: true } } } } } },
        items: { include: { material: true } },
      },
    }),
    prisma.outboundOrder.count({ where }),
  ]);
  return { orders, total, page, pageSize };
}

export async function getOutboundOrderById(tenantId: string, id: string) {
  const order = await prisma.outboundOrder.findFirst({
    where: { id, tenantId },
    include: {
      subProject: { include: { department: { include: { contract: { select: { id: true, name: true } } } } } },
      items: { include: { material: true } },
    },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '出库单不存在' };
  return order;
}

export interface CreateOutboundData {
  tenantId: string;
  userId?: string;
  subProjectId?: string | null;
  departmentId?: string | null;
  workTeamId?: string;
  outboundDate: string;
  remark?: string;
  items: Array<{ materialId: string; quantity: number; projectName?: string }>;
}

export async function createOutbound(data: CreateOutboundData) {
  const spId = data.subProjectId || null;

  // 预验证库存
  for (const item of data.items) {
    let projectName: string | null = item.projectName ?? null;
    if (!projectName) {
      const inboundItem = await prisma.inboundItem.findFirst({
        where: { materialId: item.materialId, projectName: { not: null }, inboundOrder: { tenantId: data.tenantId } },
        orderBy: { inboundOrder: { inboundDate: 'desc' } },
      });
      projectName = inboundItem?.projectName ?? null;
    }
    const inv = await prisma.inventory.findFirst({
      where: { subProjectId: spId, materialId: item.materialId, projectName: projectName || '待分配物资' },
    });
    if (!inv || inv.quantity < item.quantity) {
      const material = await prisma.material.findUnique({ where: { id: item.materialId } });
      throw { status: 400, code: 'INSUFFICIENT_STOCK', message: `物资「${material?.name || item.materialId}」库存不足` };
    }
  }

  const orderNo = await generateOrderNo('OUT');
  return prisma.$transaction(async (tx) => {
    // Resolve project names
    const resolvedItems = await Promise.all(data.items.map(async item => {
      let projectName: string | null = item.projectName ?? null;
      if (!projectName) {
        const inboundItem = await tx.inboundItem.findFirst({
          where: { materialId: item.materialId, projectName: { not: null }, inboundOrder: { tenantId: data.tenantId } },
          orderBy: { inboundOrder: { inboundDate: 'desc' } },
        });
        projectName = inboundItem?.projectName ?? null;
      }
      const material = await tx.material.findUnique({ where: { id: item.materialId } });
      return { ...item, projectName, unitPrice: material?.unitPrice || 0, unit: material?.unit || '' };
    }));

    const subProject = spId ? await tx.subProject.findUnique({ where: { id: spId } }) : null;
    const department = data.departmentId ? await tx.department.findUnique({ where: { id: data.departmentId } }) : null;
    const workTeam = data.workTeamId ? await tx.workTeam.findUnique({ where: { id: data.workTeamId } }) : null;

    const order = await (tx.outboundOrder as any).create({
      data: {
        tenantId: data.tenantId, orderNo, subProjectId: spId,
        departmentId: data.departmentId || null,
        workTeamId: data.workTeamId,
        workTeamName: workTeam?.name || null,
        outboundDate: new Date(data.outboundDate),
        remark: data.remark,
        items: { create: resolvedItems.map(item => ({
          materialId: item.materialId, projectName: item.projectName,
          subProjectId: spId, subProjectName: subProject?.name || department?.name || '',
          quantity: item.quantity, unitPrice: item.unitPrice, unit: item.unit,
        })) },
      },
    });

    // Deduct inventory
    for (const item of resolvedItems) {
      const inv = await tx.inventory.findFirst({
        where: { subProjectId: spId, materialId: item.materialId, projectName: item.projectName || '待分配物资' },
      });
      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity }, outQuantity: { increment: item.quantity } },
        });
      }
    }

    return { order, subProject, department, workTeam };
  });
}

export async function deleteOutboundOrder(tenantId: string, id: string) {
  const order = await prisma.outboundOrder.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: '出库单不存在' };

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const inv = await tx.inventory.findFirst({
        where: { subProjectId: order.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' },
      });
      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { increment: item.quantity }, outQuantity: { decrement: item.quantity } },
        });
      } else {
        await tx.inventory.create({
          data: { tenantId, subProjectId: order.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资', quantity: item.quantity, outQuantity: 0 },
        });
      }
    }
    await tx.outboundOrder.update({ where: { id }, data: { isActive: false } });
  });
}

export async function getOutboundExportData(tenantId: string, subProjectId?: string, workTeamId?: string, keyword?: string, startDate?: string, endDate?: string) {
  const where: any = { tenantId };
  if (subProjectId) where.subProjectId = subProjectId;
  if (workTeamId) where.workTeamId = workTeamId;
  if (startDate || endDate) {
    where.outboundDate = {};
    if (startDate) where.outboundDate.gte = new Date(startDate);
    if (endDate) where.outboundDate.lte = new Date(endDate);
  }
  if (keyword) where.items = { some: { material: { name: { contains: keyword, mode: 'insensitive' } } } };

  const orders = await prisma.outboundOrder.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { subProject: true, items: { include: { material: true } }, creator: { select: { name: true } } },
  });

  const rows = orders.flatMap(o =>
    o.items.map((item: any) => ({
      '出库单号': o.orderNo, '出库日期': o.outboundDate.toLocaleDateString('zh-CN'),
      '子项目名称': o.subProject?.name || '', '班组': o.workTeamId || '',
      '物资名称': item.material?.name || '', '物资编码': item.material?.code || '',
      '项目名称': item.projectName || '', '单位': item.unit,
      '数量': item.quantity, '单价': item.unitPrice, '金额': item.quantity * item.unitPrice,
      '创建人': o.creator?.name || '',
    }))
  );

  return { rows, count: orders.length };
}

// ============================================
// 六、退库管理
// ============================================

export interface ReturnListParams {
  tenantId: string;
  subProjectId?: string;
  workTeamId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listReturnOrders(params: ReturnListParams) {
  const { tenantId, subProjectId, workTeamId, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const where: any = { tenantId };
  if (subProjectId) where.subProjectId = subProjectId;
  if (workTeamId) where.workTeamId = workTeamId;
  if (startDate || endDate) {
    where.returnDate = {};
    if (startDate) where.returnDate.gte = new Date(startDate);
    if (endDate) where.returnDate.lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    prisma.returnOrder.findMany({
      where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { subProject: true, items: { include: { material: true } } },
    }),
    prisma.returnOrder.count({ where }),
  ]);
  return { orders, total, page, pageSize };
}

export interface ReturnableItemsParams {
  tenantId: string;
  subProjectId?: string;
  workTeamId?: string;
  startDate?: string;
  endDate?: string;
}

export async function listReturnableOutboundItems(params: ReturnableItemsParams) {
  const { tenantId, subProjectId, workTeamId, startDate, endDate } = params;
  const where: any = {
    outboundOrder: { tenantId, isActive: true },
  };
  if (subProjectId) where.outboundOrder.subProjectId = subProjectId;
  if (workTeamId) where.outboundOrder.workTeamId = workTeamId;
  if (startDate || endDate) {
    where.outboundOrder.outboundDate = {};
    if (startDate) where.outboundOrder.outboundDate.gte = new Date(startDate);
    if (endDate) where.outboundOrder.outboundDate.lte = new Date(endDate);
  }

  const items = await prisma.outboundItem.findMany({
    where,
    include: { material: true, outboundOrder: { select: { orderNo: true, outboundDate: true, subProjectId: true } } },
    orderBy: { outboundOrder: { outboundDate: 'desc' } },
  });

  const result = await Promise.all(items.map(async item => {
    const returnedAgg = await prisma.returnItem.aggregate({
      where: { outboundItemId: item.id },
      _sum: { quantity: true },
    });
    const returnedQuantity = Number(returnedAgg._sum.quantity || 0);
    return { ...item, returnedQuantity, availableQuantity: item.quantity - returnedQuantity };
  }));

  return result.filter(item => item.availableQuantity > 0);
}

export interface CreateReturnData {
  tenantId: string;
  userId?: string;
  subProjectId: string;
  workTeamId?: string;
  returnDate: string;
  remark?: string;
  items: Array<{ outboundItemId?: string; materialId: string; quantity: number; projectName?: string; unitPrice?: number; unit?: string }>;
}

export async function createReturn(data: CreateReturnData) {
  const orderNo = await generateOrderNo('RET');
  return prisma.$transaction(async (tx) => {
    const resolvedItems = await Promise.all(data.items.map(async item => {
      let projectName: string | null = item.projectName ?? null;
      if (!projectName && item.outboundItemId) {
        const obItem = await tx.outboundItem.findUnique({ where: { id: item.outboundItemId }, select: { projectName: true } });
        projectName = obItem?.projectName ?? null;
      }
      const material = await tx.material.findUnique({ where: { id: item.materialId } });
      return { ...item, projectName, unitPrice: item.unitPrice || material?.unitPrice || 0, unit: item.unit || material?.unit || '' };
    }));

    const order = await tx.returnOrder.create({
      data: {
        tenantId: data.tenantId, orderNo, subProjectId: data.subProjectId,
        workTeamId: data.workTeamId, returnDate: new Date(data.returnDate),
        remark: data.remark,
        items: { create: resolvedItems.map(item => ({
          outboundItemId: item.outboundItemId, materialId: item.materialId,
          quantity: item.quantity,
        })) },
      },
    });

    for (const item of resolvedItems) {
      await tx.inventory.upsert({
        where: { subProjectId_materialId_projectName: { subProjectId: data.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' } },
        create: { tenantId: data.tenantId, subProjectId: data.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资', quantity: item.quantity, outQuantity: 0 },
        update: { quantity: { increment: item.quantity }, outQuantity: { decrement: item.quantity } },
      });
    }

    return order;
  });
}

export interface CreateExcelReturnData {
  tenantId: string;
  userId?: string;
  subProjectId?: string;
  returnDate: string;
  remark?: string;
  items: Array<{ materialId: string; quantity: number; projectName?: string; unitPrice?: number; unit?: string }>;
}

export async function createExcelReturn(data: CreateExcelReturnData) {
  const orderNo = await generateOrderNo('RET');
  return prisma.$transaction(async (tx) => {
    const order = await tx.returnOrder.create({
      data: {
        tenantId: data.tenantId, orderNo, subProjectId: data.subProjectId,
        returnDate: new Date(data.returnDate), source: 'excel', remark: data.remark,
        items: { create: data.items.map(item => ({
          materialId: item.materialId,
          quantity: item.quantity,
        })) },
      },
    });

    for (const item of data.items) {
      if (data.subProjectId) {
        await tx.inventory.upsert({
          where: { subProjectId_materialId_projectName: { subProjectId: data.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资' } },
          create: { tenantId: data.tenantId, subProjectId: data.subProjectId, materialId: item.materialId, projectName: item.projectName || '待分配物资', quantity: item.quantity, outQuantity: 0 },
          update: { quantity: { increment: item.quantity } },
        });
      }
    }

    return order;
  });
}

// ============================================
// 七、调拨管理
// ============================================

export interface TransferListParams {
  tenantId: string;
  fromSubProjectId?: string;
  toSubProjectId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listTransferOrders(params: TransferListParams) {
  const { tenantId, fromSubProjectId, toSubProjectId, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const where: any = { tenantId };
  if (fromSubProjectId) where.fromSubProjectId = fromSubProjectId;
  if (toSubProjectId) where.toSubProjectId = toSubProjectId;
  if (startDate || endDate) {
    where.transferDate = {};
    if (startDate) where.transferDate.gte = new Date(startDate);
    if (endDate) where.transferDate.lte = new Date(endDate);
  }

  const [orders, total] = await Promise.all([
    prisma.transferOrder.findMany({
      where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { fromSubProject: true, toSubProject: true, items: { include: { material: true } } },
    }),
    prisma.transferOrder.count({ where }),
  ]);
  return { orders, total, page, pageSize };
}

export interface CreateTransferData {
  tenantId: string;
  userId?: string;
  fromSubProjectId?: string;
  toSubProjectId?: string;
  fromDepartmentId?: string;
  toDepartmentId?: string;
  transferDate: string;
  remark?: string;
  items: Array<{ materialId: string; quantity: number; projectName?: string }>;
}

export async function createTransfer(data: CreateTransferData) {
  const fromDeptId = data.fromDepartmentId || null;
  const toDeptId = data.toDepartmentId || null;
  const fromSpId = data.fromSubProjectId || null;
  const toSpId = data.toSubProjectId || null;

  // Pre-validate stock using departmentId or subProjectId
  for (const item of data.items) {
    const invWhere: any = { materialId: item.materialId, projectName: item.projectName || '待分配物资' };
    if (fromSpId) invWhere.subProjectId = fromSpId;
    else if (fromDeptId) invWhere.departmentId = fromDeptId;
    const inv = await prisma.inventory.findFirst({ where: invWhere });
    if (!inv || inv.quantity < item.quantity) {
      const material = await prisma.material.findUnique({ where: { id: item.materialId } });
      throw { status: 400, code: 'INSUFFICIENT_STOCK', message: `物资「${material?.name || item.materialId}」库存不足` };
    }
  }

  const orderNo = await generateOrderNo('TRF');
  return prisma.$transaction(async (tx) => {
    let fromSubProject: any = null;
    let toSubProject: any = null;
    if (fromSpId) fromSubProject = await tx.subProject.findUnique({ where: { id: fromSpId } });
    if (toSpId) toSubProject = await tx.subProject.findUnique({ where: { id: toSpId } });

    let fromDepartment: any = null;
    let toDepartment: any = null;
    if (fromDeptId) fromDepartment = await tx.department.findUnique({ where: { id: fromDeptId }, include: { contract: true } });
    if (toDeptId) toDepartment = await tx.department.findUnique({ where: { id: toDeptId }, include: { contract: true } });

    const order = await tx.transferOrder.create({
      data: {
        tenantId: data.tenantId, orderNo,
        fromSubProjectId: fromSpId || undefined,
        toSubProjectId: toSpId || undefined,
        transferDate: new Date(data.transferDate),
        remark: data.remark,
        items: { create: data.items.map(item => ({
          materialId: item.materialId, quantity: item.quantity,
        })) },
      },
    });

    for (const item of data.items) {
      // Deduct from source (find by subProjectId or departmentId)
      const sourceWhere: any = { materialId: item.materialId, projectName: item.projectName || '待分配物资' };
      if (fromSpId) sourceWhere.subProjectId = fromSpId;
      else if (fromDeptId) sourceWhere.departmentId = fromDeptId;
      const sourceInv = await tx.inventory.findFirst({ where: sourceWhere });
      if (sourceInv) {
        await tx.inventory.update({ where: { id: sourceInv.id }, data: { quantity: { decrement: item.quantity } } });
      }

      // Add to target (find existing or create)
      const targetWhere: any = { materialId: item.materialId, projectName: item.projectName || '待分配物资' };
      if (toSpId) targetWhere.subProjectId = toSpId;
      else if (toDeptId) targetWhere.departmentId = toDeptId;
      const existing = await tx.inventory.findFirst({ where: targetWhere });
      if (existing) {
        await tx.inventory.update({ where: { id: existing.id }, data: { quantity: { increment: item.quantity } } });
      } else {
        await tx.inventory.create({
          data: {
            tenantId: data.tenantId,
            subProjectId: toSpId || null,
            departmentId: toDeptId || null,
            materialId: item.materialId,
            projectName: item.projectName || '待分配物资',
            quantity: item.quantity,
            outQuantity: 0,
          },
        });
      }
    }

    return { order, fromSubProject, toSubProject, fromDepartment, toDepartment };
  });
}

export async function getTransferExportData(tenantId: string, fromSubProjectId?: string, toSubProjectId?: string) {
  const where: any = { tenantId };
  if (fromSubProjectId) where.fromSubProjectId = fromSubProjectId;
  if (toSubProjectId) where.toSubProjectId = toSubProjectId;

  const orders = await prisma.transferOrder.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { fromSubProject: true, toSubProject: true, items: { include: { material: true } } },
  });

  const rows = orders.flatMap(o =>
    o.items.map((item: any) => ({
      '调拨单号': o.orderNo, '调拨日期': o.transferDate.toLocaleDateString('zh-CN'),
      '调出项目': o.fromSubProject?.name || '', '调入项目': o.toSubProject?.name || '',
      '物资名称': item.material?.name || '', '物资编码': item.material?.code || '',
      '项目名称': item.projectName || '', '数量': item.quantity,
    }))
  );

  return { rows, count: orders.length };
}

// ============================================
// 八、供应商查询
// ============================================

export async function listSuppliers(tenantId: string, name?: string) {
  const where: any = { tenantId };
  if (name) where.name = { contains: name, mode: 'insensitive' };
  const suppliers = await prisma.supplier.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { _count: { select: { deliveryOrders: true, contracts: true } } },
  });
  return suppliers.map((supplier) => ({
    ...supplier,
    contact: supplier.contactName,
  }));
}

// ============================================
// 九、班组查询
// ============================================

export interface WorkTeamListParams {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listWorkTeams(params: WorkTeamListParams) {
  const { tenantId, search, page, pageSize } = params;
  const where: any = { tenantId };
  if (search) {
    where.OR = [{ name: { contains: search } }, { leaderName: { contains: search } }];
  }
  const [total, teams] = await Promise.all([
    prisma.workTeam.count({ where }),
    prisma.workTeam.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    teams: teams.map((team) => ({
      ...team,
      leader: team.leaderName,
    })),
    total,
    totalPages: Math.ceil(total / pageSize),
    page,
    pageSize,
  };
}

// ============================================
// 十、班组台账
// ============================================

export interface WorkTeamLedgerParams {
  tenantId: string;
  workTeamId?: string;
  subProjectId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export async function listWorkTeamLedger(params: WorkTeamLedgerParams) {
  const { tenantId, workTeamId, subProjectId, keyword, startDate, endDate, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const where: any = {
    outboundOrder: { tenantId },
  };
  if (workTeamId) where.outboundOrder.workTeamId = workTeamId;
  if (subProjectId) where.outboundOrder.subProjectId = subProjectId;
  if (startDate || endDate) {
    where.outboundOrder.outboundDate = {};
    if (startDate) where.outboundOrder.outboundDate.gte = new Date(startDate);
    if (endDate) where.outboundOrder.outboundDate.lte = new Date(endDate);
  }

  const items = await prisma.outboundItem.findMany({
    where, orderBy: { outboundOrder: { outboundDate: 'desc' } },
    include: { material: true, outboundOrder: { include: { subProject: true } } },
  });

  const result = await Promise.all(items.map(async item => {
    const returned = await prisma.returnItem.aggregate({
      where: { outboundItemId: item.id, materialId: item.materialId },
      _sum: { quantity: true },
    });
    const returnedQuantity = Number(returned._sum?.quantity || 0);
    const netQuantity = item.quantity - returnedQuantity;
    return {
      id: item.id,
      workTeamName: item.outboundOrder.workTeamName || '',
      materialName: item.material?.name || '',
      unit: item.material?.unit || item.unit || '',
      quantity: netQuantity,
      unitPrice: item.unitPrice || 0,
      totalAmount: netQuantity * Number(item.unitPrice || 0),
      outboundDate: item.outboundOrder.outboundDate,
      projectName: item.projectName || item.outboundOrder.subProject?.name || '',
      type: 'outbound',
      returnedQuantity,
    };
  }));

  const normalizedKeyword = keyword?.trim().toLowerCase();
  const filtered = normalizedKeyword
    ? result.filter(item =>
      item.materialName.toLowerCase().includes(normalizedKeyword) ||
      item.workTeamName.toLowerCase().includes(normalizedKeyword) ||
      item.projectName.toLowerCase().includes(normalizedKeyword)
    )
    : result;

  return { items: filtered.slice(skip, skip + pageSize), total: filtered.length, page, pageSize };
}

export async function getWorkTeamLedgerExportData(tenantId: string, workTeamId?: string, subProjectId?: string) {
  const where: any = { outboundOrder: { tenantId } };
  if (workTeamId) where.outboundOrder.workTeamId = workTeamId;
  if (subProjectId) where.outboundOrder.subProjectId = subProjectId;

  const items = await prisma.outboundItem.findMany({
    where, orderBy: { outboundOrder: { outboundDate: 'desc' } },
    include: { material: true, outboundOrder: { include: { subProject: true } } },
  });

  const rows = await Promise.all(items.map(async item => {
    const returned = await prisma.returnItem.aggregate({
      where: { outboundItemId: item.id, materialId: item.materialId },
      _sum: { quantity: true },
    });
    const returnedQuantity = Number(returned._sum?.quantity || 0);
    const netQuantity = item.quantity - returnedQuantity;
    const unitPrice = Number(item.unitPrice || 0);

    return {
      '班组': item.outboundOrder.workTeamName || '',
      '子项目名称': item.outboundOrder.subProject?.name || '',
      '子项目编码': item.outboundOrder.subProject?.code || '',
      '项目名称': item.projectName || item.outboundOrder.subProject?.name || '',
      '物资名称': item.material?.name || '',
      '物资编码': item.material?.code || '',
      '单位': item.material?.unit || item.unit || '',
      '原领数量': item.quantity,
      '已退数量': returnedQuantity,
      '净领用数量': netQuantity,
      '单价': unitPrice,
      '金额': netQuantity * unitPrice,
      '出库单号': item.outboundOrder.orderNo,
      '出库日期': item.outboundOrder.outboundDate.toLocaleDateString('zh-CN'),
    };
  }));

  return { rows, count: items.length };
}
