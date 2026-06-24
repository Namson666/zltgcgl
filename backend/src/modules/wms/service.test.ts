import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    material: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    inboundOrder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    deliveryOrder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    inboundItem: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    subProject: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    returnOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    outboundOrder: {
      findMany: vi.fn(),
    },
    outboundItem: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    returnItem: {
      aggregate: vi.fn(),
    },
    transferOrder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../common/utils/prisma', () => ({
  prisma: prismaMock,
}));

import { createExcelInbound, createTransfer, deleteMaterial, getDeliveryOrderExportData, getInventoryExportData, getOutboundExportData, getTransferExportData, getWorkTeamLedgerExportData, listDeliveryOrders, listInboundOrders, listInventory, listMaterials, listReturnOrders, listTransferOrders, listWorkTeamLedger, updateMaterial } from './service';

describe('wms material service tenant safeguards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T00:00:00.000Z'));
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists materials with sqlite-safe contains filters', async () => {
    prismaMock.material.findMany.mockResolvedValue([]);

    await listMaterials('tenant-1', { name: '钢筋', code: 'MAT' });

    expect(prismaMock.material.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        name: { contains: '钢筋' },
        code: { contains: 'MAT' },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('updates materials only inside the requested tenant', async () => {
    prismaMock.material.findFirst.mockResolvedValue({ id: 'material-1', tenantId: 'tenant-1' });
    prismaMock.material.update.mockResolvedValue({ id: 'material-1', name: '新物资' });

    await updateMaterial('tenant-1', 'material-1', { name: '新物资' });

    expect(prismaMock.material.findFirst).toHaveBeenCalledWith({
      where: { id: 'material-1', tenantId: 'tenant-1' },
    });
    expect(prismaMock.material.update).toHaveBeenCalledWith({
      where: { id: 'material-1' },
      data: { name: '新物资' },
    });
  });

  it('deletes materials only inside the requested tenant', async () => {
    prismaMock.material.findFirst.mockResolvedValue({ id: 'material-1', tenantId: 'tenant-1' });
    prismaMock.material.delete.mockResolvedValue({ id: 'material-1' });

    await deleteMaterial('tenant-1', 'material-1');

    expect(prismaMock.material.findFirst).toHaveBeenCalledWith({
      where: { id: 'material-1', tenantId: 'tenant-1' },
    });
    expect(prismaMock.material.delete).toHaveBeenCalledWith({
      where: { id: 'material-1' },
    });
  });

  it('rejects cross-tenant material updates', async () => {
    prismaMock.material.findFirst.mockResolvedValue(null);

    await expect(updateMaterial('tenant-1', 'other-tenant-material', { name: '非法修改' })).rejects.toMatchObject({
      code: 'MATERIAL_NOT_FOUND',
    });
    expect(prismaMock.material.update).not.toHaveBeenCalled();
  });

  it('creates excel inbound with department, supplier, generated sub-project, and inventory association', async () => {
    prismaMock.inboundOrder.findFirst.mockResolvedValue(null);
    prismaMock.material.findFirst.mockResolvedValue(null);
    prismaMock.material.create.mockResolvedValue({ id: 'material-1', name: '水泥', unit: '吨' });
    prismaMock.subProject.findFirst.mockResolvedValue(null);
    prismaMock.subProject.create.mockResolvedValue({ id: 'sub-project-1', departmentId: 'dept-1', name: '1号楼' });
    prismaMock.inboundOrder.create.mockResolvedValue({ id: 'inbound-1', orderNo: 'IN-20260623-0001' });
    prismaMock.inboundItem.create.mockResolvedValue({ id: 'inbound-item-1' });
    prismaMock.inventory.findFirst.mockResolvedValue(null);
    prismaMock.inventory.create.mockResolvedValue({ id: 'inventory-1' });

    const order = await createExcelInbound({
      tenantId: 'tenant-1',
      userId: 'user-1',
      contractId: 'contract-1',
      departmentId: 'dept-1',
      supplierName: 'Excel供应商',
      inboundDate: '2026-06-23',
      items: [
        { materialName: '水泥', projectName: '1号楼', unit: '吨', quantity: 10, unitPrice: 350 },
      ],
    });

    expect(order).toEqual({ id: 'inbound-1', orderNo: 'IN-20260623-0001' });
    expect(prismaMock.subProject.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', departmentId: 'dept-1', name: '1号楼', isActive: true },
    });
    expect(prismaMock.subProject.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', departmentId: 'dept-1', name: '1号楼', code: null, description: '由Excel入库项目名称自动创建' },
    });
    expect(prismaMock.inboundOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        orderNo: 'IN-20260623-0001',
        subProjectId: 'sub-project-1',
        contractId: 'contract-1',
        departmentId: 'dept-1',
        supplierName: 'Excel供应商',
        source: 'excel',
        createdBy: 'user-1',
      }),
    });
    expect(prismaMock.inventory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        subProjectId: 'sub-project-1',
        materialId: 'material-1',
        projectName: '1号楼',
        quantity: 10,
      }),
    });
  });

  it('lists delivery orders with date and sub-project filters used by exports', async () => {
    prismaMock.deliveryOrder.findMany.mockResolvedValue([]);
    prismaMock.deliveryOrder.count.mockResolvedValue(0);

    await listDeliveryOrders({
      tenantId: 'tenant-1',
      contractId: 'contract-1',
      supplierId: 'supplier-1',
      subProjectId: 'sub-project-1',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.deliveryOrder.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        supplierId: 'supplier-1',
        subProjectId: 'sub-project-1',
        deliveryDate: {
          gte: new Date('2026-06-01'),
          lte: new Date('2026-06-30'),
        },
      },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { contract: { select: { id: true, name: true } }, supplier: true, items: true },
    });
  });

  it('exports delivery orders through the filtered delivery list', async () => {
    prismaMock.deliveryOrder.findMany.mockResolvedValue([
      {
        orderNo: 'DO-20260623-0001',
        deliveryDate: new Date('2026-06-23'),
        contract: { name: '承包合同A' },
        supplier: { name: '送货供应商' },
        items: [
          {
            material: { name: '钢筋', spec: 'HRB400', unit: '吨' },
            materialName: '钢筋',
            spec: 'HRB400',
            unit: '吨',
            deliveryQty: 8,
            actualQty: 7,
            projectName: '1号楼',
          },
        ],
      },
    ]);
    prismaMock.deliveryOrder.count.mockResolvedValue(1);

    const result = await getDeliveryOrderExportData({
      tenantId: 'tenant-1',
      subProjectId: 'sub-project-1',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });

    expect(prismaMock.deliveryOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        subProjectId: 'sub-project-1',
        deliveryDate: {
          gte: new Date('2026-06-01'),
          lte: new Date('2026-06-30'),
        },
      },
      take: 100000,
    }));
    expect(result.rows).toEqual([
      expect.objectContaining({
        '送货单号': 'DO-20260623-0001',
        '合同名称': '承包合同A',
        '供应商': '送货供应商',
        '物资名称': '钢筋',
        '送货数量': 8,
        '实收数量': 7,
        '项目名称': '1号楼',
      }),
    ]);
  });

  it('lists inbound orders with sqlite-safe order and material filters', async () => {
    prismaMock.inboundOrder.findMany.mockResolvedValue([]);
    prismaMock.inboundOrder.count.mockResolvedValue(0);

    await listInboundOrders({
      tenantId: 'tenant-1',
      orderNo: 'IN-001',
      materialName: '水泥',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.inboundOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
        orderNo: { contains: 'IN-001' },
        items: { some: { material: { name: { contains: '水泥' } } } },
      },
    }));
  });

  it('lists only active return orders', async () => {
    prismaMock.returnOrder.findMany.mockResolvedValue([]);
    prismaMock.returnOrder.count.mockResolvedValue(0);

    await listReturnOrders({
      tenantId: 'tenant-1',
      subProjectId: 'sub-project-1',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.returnOrder.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true, subProjectId: 'sub-project-1' },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { subProject: true, items: { include: { material: true } } },
    });
    expect(prismaMock.returnOrder.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true, subProjectId: 'sub-project-1' },
    });
  });

  it('exports only active outbound orders', async () => {
    prismaMock.outboundOrder.findMany.mockResolvedValue([]);

    await getOutboundExportData('tenant-1', 'sub-project-1', 'work-team-1', '钢筋', '2026-06-01', '2026-06-30');

    expect(prismaMock.outboundOrder.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
        subProjectId: 'sub-project-1',
        workTeamId: 'work-team-1',
        outboundDate: {
          gte: new Date('2026-06-01'),
          lte: new Date('2026-06-30'),
        },
        items: { some: { material: { name: { contains: '钢筋' } } } },
      },
      orderBy: { createdAt: 'desc' },
      include: { subProject: true, items: { include: { material: true } }, creator: { select: { name: true } } },
    });
  });

  it('filters inventory by material name with sqlite-safe contains syntax', async () => {
    prismaMock.inventory.findMany.mockResolvedValue([]);
    prismaMock.inventory.count.mockResolvedValue(0);

    await listInventory({
      tenantId: 'tenant-1',
      status: 'in',
      materialName: '钢筋',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.inventory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { material: { tenantId: 'tenant-1' } },
          { isActive: true },
          { quantity: { gt: 0 } },
          { material: { name: { contains: '钢筋' } } },
        ],
      },
    }));
  });

  it('exports inventory using the same active stock filters and department fallback columns', async () => {
    prismaMock.inventory.findMany.mockResolvedValue([
      {
        id: 'inventory-1',
        projectName: '1号楼',
        quantity: 7,
        outQuantity: 3,
        material: { name: '钢筋', code: 'MAT-001', unit: '吨', unitPrice: 11 },
        subProject: null,
        department: { name: '第一项目部', contract: { name: '承包合同A' } },
      },
    ]);
    prismaMock.inventory.count.mockResolvedValue(1);

    const result = await getInventoryExportData({
      tenantId: 'tenant-1',
      status: 'in',
      viewMode: 'summary',
      materialName: '钢筋',
    });

    expect(prismaMock.inventory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { material: { tenantId: 'tenant-1' } },
          { isActive: true },
          { quantity: { gt: 0 } },
          { material: { name: { contains: '钢筋' } } },
        ],
      },
      take: 100000,
    }));
    expect(result.rows).toEqual([
      expect.objectContaining({
        '合同名称': '承包合同A',
        '项目部': '第一项目部',
        '项目名称': '1号楼',
        '物资名称': '钢筋',
        '在库数量': 7,
        '已出库数量': 3,
        '库存金额': 77,
      }),
    ]);
  });

  it('lists active work-team ledger rows with active return quantities only', async () => {
    prismaMock.outboundItem.findMany.mockResolvedValue([
      {
        id: 'outbound-item-1',
        materialId: 'material-1',
        quantity: 4,
        unitPrice: 11,
        unit: '件',
        projectName: '1号楼',
        material: { name: '扣件', unit: '件' },
        outboundOrder: {
          workTeamName: '木工班组',
          outboundDate: new Date('2026-06-23'),
          subProject: { name: '1号楼' },
        },
      },
    ]);
    prismaMock.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });

    const result = await listWorkTeamLedger({
      tenantId: 'tenant-1',
      keyword: '扣件',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.outboundItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { outboundOrder: { tenantId: 'tenant-1', isActive: true } },
    }));
    expect(prismaMock.returnItem.aggregate).toHaveBeenCalledWith({
      where: { outboundItemId: 'outbound-item-1', materialId: 'material-1', returnOrder: { isActive: true } },
      _sum: { quantity: true },
    });
    expect(result.items[0]).toEqual(expect.objectContaining({
      materialName: '扣件',
      quantity: 3,
      returnedQuantity: 1,
      totalAmount: 33,
    }));
  });

  it('exports work-team ledger through the filtered net-quantity list', async () => {
    prismaMock.outboundItem.findMany.mockResolvedValue([
      {
        id: 'outbound-item-1',
        materialId: 'material-1',
        quantity: 4,
        unitPrice: 11,
        unit: '件',
        projectName: '1号楼',
        material: { name: '扣件', unit: '件' },
        outboundOrder: {
          workTeamName: '木工班组',
          outboundDate: new Date('2026-06-23'),
          subProject: { name: '1号楼' },
        },
      },
    ]);
    prismaMock.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });

    const result = await getWorkTeamLedgerExportData({
      tenantId: 'tenant-1',
      keyword: '扣件',
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        '班组': '木工班组',
        '物资名称': '扣件',
        '已退数量': 1,
        '净领用数量': 3,
        '金额': 33,
      }),
    ]);
  });

  it('lists only active transfer orders', async () => {
    prismaMock.transferOrder.findMany.mockResolvedValue([]);
    prismaMock.transferOrder.count.mockResolvedValue(0);

    await listTransferOrders({
      tenantId: 'tenant-1',
      fromSubProjectId: 'from-sub-1',
      toSubProjectId: 'to-sub-1',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.transferOrder.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
        fromSubProjectId: 'from-sub-1',
        toSubProjectId: 'to-sub-1',
      },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        fromSubProject: { include: { department: { include: { contract: true } } } },
        toSubProject: { include: { department: { include: { contract: true } } } },
        fromDepartment: { include: { contract: true } },
        toDepartment: { include: { contract: true } },
        items: { include: { material: true } },
      },
    });
    expect(prismaMock.transferOrder.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
        fromSubProjectId: 'from-sub-1',
        toSubProjectId: 'to-sub-1',
      },
    });
  });

  it('exports only active transfer orders', async () => {
    prismaMock.transferOrder.findMany.mockResolvedValue([]);

    await getTransferExportData('tenant-1', 'from-sub-1', 'to-sub-1');

    expect(prismaMock.transferOrder.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
        fromSubProjectId: 'from-sub-1',
        toSubProjectId: 'to-sub-1',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromSubProject: { include: { department: { include: { contract: true } } } },
        toSubProject: { include: { department: { include: { contract: true } } } },
        fromDepartment: { include: { contract: true } },
        toDepartment: { include: { contract: true } },
        items: { include: { material: true } },
      },
    });
  });

  it('creates department-scoped transfer orders with source and target departments', async () => {
    prismaMock.inventory.findFirst
      .mockResolvedValueOnce({ id: 'source-inventory-1', quantity: 5 })
      .mockResolvedValueOnce({ id: 'source-inventory-1', quantity: 5 })
      .mockResolvedValueOnce(null);
    prismaMock.material.findUnique.mockResolvedValue({ id: 'material-1', name: '钢筋', unit: '吨' });
    prismaMock.department.findUnique
      .mockResolvedValueOnce({ id: 'from-dept-1', name: '第一项目部' })
      .mockResolvedValueOnce({ id: 'to-dept-1', name: '第二项目部' });
    prismaMock.transferOrder.create.mockResolvedValue({ id: 'transfer-1', orderNo: 'TRF-20260623-0001' });
    prismaMock.transferOrder.findFirst.mockResolvedValue(null);
    prismaMock.inventory.update.mockResolvedValue({ id: 'source-inventory-1' });
    prismaMock.inventory.create.mockResolvedValue({ id: 'target-inventory-1' });

    const result = await createTransfer({
      tenantId: 'tenant-1',
      fromDepartmentId: 'from-dept-1',
      toDepartmentId: 'to-dept-1',
      transferDate: '2026-06-23',
      remark: '项目部调拨',
      items: [{ materialId: 'material-1', quantity: 2, projectName: '1号楼' }],
    });

    expect(result.order).toEqual({ id: 'transfer-1', orderNo: 'TRF-20260623-0001' });
    expect(prismaMock.transferOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        orderNo: 'TRF-20260623-0001',
        fromDepartmentId: 'from-dept-1',
        toDepartmentId: 'to-dept-1',
        transferDate: new Date('2026-06-23'),
        remark: '项目部调拨',
      }),
    });
    expect(prismaMock.inventory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        departmentId: 'to-dept-1',
        materialId: 'material-1',
        projectName: '1号楼',
        quantity: 2,
      }),
    });
  });
});
