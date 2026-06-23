import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    material: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    inboundOrder: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    inboundItem: {
      create: vi.fn(),
    },
    subProject: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    returnOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../common/utils/prisma', () => ({
  prisma: prismaMock,
}));

import { createExcelInbound, deleteMaterial, listMaterials, listReturnOrders, updateMaterial } from './service';

describe('wms material service tenant safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
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
});
