import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    material: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../common/utils/prisma', () => ({
  prisma: prismaMock,
}));

import { deleteMaterial, listMaterials, updateMaterial } from './service';

describe('wms material service tenant safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
