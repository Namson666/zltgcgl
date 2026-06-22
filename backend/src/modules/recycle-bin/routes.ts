/**
 * 资料通工程管理系统 - 回收站管理路由
 *
 * 提供回收站相关的 API 接口，包括：
 * - 查询已删除的合同、入库单、出库单
 * - 恢复已删除的项目
 * - 永久删除项目
 */

import { Router, Response } from 'express';
import { prisma } from '../../common/utils/prisma';
import { authenticate } from '../../common/middleware/auth';
import { AuthenticatedRequest, ApiResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';

const router = Router();

/**
 * GET /api/recycle-bin
 * 获取回收站列表
 *
 * 查询当前租户下所有已软删除的合同、入库单、出库单。
 * 支持分页和按类型筛选。
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const type = req.query.type as string | undefined; // contract | inbound | outbound | all
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = req.query.search as string | undefined;

    // 按类型查询回收站项目
    const results: any[] = [];
    let totalCount = 0;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 查询已删除的合同
    if (!type || type === 'all' || type === 'contract') {
      const contractWhere: any = { tenantId, isActive: false };
      if (search) {
        contractWhere.OR = [
          { name: { contains: search } },
          { code: { contains: search } },
        ];
      }
      const [contracts, contractsTotal] = await Promise.all([
        prisma.contract.findMany({
          where: contractWhere,
          skip: type === 'contract' ? skip : 0,
          take: type === 'contract' ? take : 100,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            totalAmount: true,
            isActive: true,
            updatedAt: true,
            createdAt: true,
          },
        }),
        prisma.contract.count({ where: contractWhere }),
      ]);
      contracts.forEach(c => results.push({
        ...c,
        _type: 'contract',
        _typeLabel: '合同',
        _deletedAt: c.updatedAt,
      }));
      if (type === 'contract') totalCount = contractsTotal;
    }

    // 查询已删除的入库单
    if (!type || type === 'all' || type === 'inbound') {
      const inboundWhere: any = { tenantId, isActive: false };
      if (search) {
        inboundWhere.OR = [
          { orderNo: { contains: search } },
          { remark: { contains: search } },
        ];
      }
      const [inbounds, inboundsTotal] = await Promise.all([
        prisma.inboundOrder.findMany({
          where: inboundWhere,
          skip: type === 'inbound' ? skip : 0,
          take: type === 'inbound' ? take : 100,
          orderBy: { updatedAt: 'desc' },
          include: {
            deliveryOrder: { select: { supplier: { select: { name: true } } } },
          },
        }),
        prisma.inboundOrder.count({ where: inboundWhere }),
      ]);
      inbounds.forEach(o => results.push({
        id: o.id,
        name: `入库单 ${o.orderNo}`,
        code: o.orderNo,
        _type: 'inbound',
        _typeLabel: '入库单',
        _deletedAt: o.updatedAt,
        supplierName: (o as any).deliveryOrder?.supplier?.name || null,
        totalAmount: null,
      }));
      if (type === 'inbound') totalCount = inboundsTotal;
    }

    // 查询已删除的出库单
    if (!type || type === 'all' || type === 'outbound') {
      const outboundWhere: any = { tenantId, isActive: false };
      if (search) {
        outboundWhere.OR = [
          { orderNo: { contains: search } },
          { remark: { contains: search } },
        ];
      }
      const [outbounds, outboundsTotal] = await Promise.all([
        prisma.outboundOrder.findMany({
          where: outboundWhere,
          skip: type === 'outbound' ? skip : 0,
          take: type === 'outbound' ? take : 100,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.outboundOrder.count({ where: outboundWhere }),
      ]);
      outbounds.forEach(o => results.push({
        id: o.id,
        name: `出库单 ${o.orderNo}`,
        code: o.orderNo,
        _type: 'outbound',
        _typeLabel: '出库单',
        _deletedAt: o.updatedAt,
        supplierName: null,
        totalAmount: null,
      }));
      if (type === 'outbound') totalCount = outboundsTotal;
    }

    // 查询已删除的退库单
    if (!type || type === 'all' || type === 'return') {
      const returnWhere: any = { tenantId, isActive: false };
      if (search) {
        returnWhere.OR = [
          { orderNo: { contains: search } },
          { remark: { contains: search } },
        ];
      }
      const [returns, returnsTotal] = await Promise.all([
        prisma.returnOrder.findMany({
          where: returnWhere,
          skip: type === 'return' ? skip : 0,
          take: type === 'return' ? take : 100,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.returnOrder.count({ where: returnWhere }),
      ]);
      returns.forEach(o => results.push({
        id: o.id,
        name: `退库单 ${o.orderNo}`,
        code: o.orderNo,
        _type: 'return',
        _typeLabel: '退库单',
        _deletedAt: o.updatedAt,
        supplierName: null,
        totalAmount: null,
      }));
      if (type === 'return') totalCount = returnsTotal;
    }

    // 查询已删除的调拨单
    if (!type || type === 'all' || type === 'transfer') {
      const transferWhere: any = { tenantId, isActive: false };
      if (search) {
        transferWhere.OR = [
          { orderNo: { contains: search } },
          { remark: { contains: search } },
        ];
      }
      const [transfers, transfersTotal] = await Promise.all([
        prisma.transferOrder.findMany({
          where: transferWhere,
          skip: type === 'transfer' ? skip : 0,
          take: type === 'transfer' ? take : 100,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.transferOrder.count({ where: transferWhere }),
      ]);
      transfers.forEach(o => results.push({
        id: o.id,
        name: `调拨单 ${o.orderNo}`,
        code: o.orderNo,
        _type: 'transfer',
        _typeLabel: '调拨单',
        _deletedAt: o.updatedAt,
        supplierName: null,
        totalAmount: null,
      }));
      if (type === 'transfer') totalCount = transfersTotal;
    }

    // 如果没有指定类型，汇总所有结果
    if (!type || type === 'all') {
      totalCount = results.length;
      // 按删除时间排序
      results.sort((a, b) => new Date(b._deletedAt).getTime() - new Date(a._deletedAt).getTime());
    }

    const totalPages = Math.ceil(totalCount / pageSize);

    // 对 all 类型做内存切片分页；单类型已在 DB 查询中分页
    const pagedResults = (!type || type === 'all')
      ? results.slice((page - 1) * pageSize, page * pageSize)
      : results;

    res.json({
      success: true,
      data: pagedResults,
      pagination: { page, pageSize, total: totalCount, totalPages },
    } as ApiResponse);
  } catch (error: any) {
    console.error('获取回收站列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取回收站列表失败',
    } as ApiResponse);
  }
});

/**
 * POST /api/recycle-bin/restore
 * 恢复回收站项目
 *
 * 请求体：
 * - items: Array<{ id: string; type: string }> - 要恢复的项目列表
 */
router.post('/restore', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { items } = req.body;

    if (!items?.length) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请指定要恢复的项目' } as ApiResponse);
      return;
    }

    const restored: string[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        const { id, type } = item;
        if (!id || !type) continue;

        if (type === 'contract') {
          const exists = await prisma.contract.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`合同 ${id} 不存在或未删除`); continue; }
          await prisma.contract.update({ where: { id }, data: { isActive: true } });
          restored.push(`合同「${exists.name}」`);
        } else if (type === 'inbound') {
          const exists = await prisma.inboundOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`入库单 ${id} 不存在或未删除`); continue; }
          // 恢复时恢复库存（按 projectName 精确匹配）
          const items_data = await prisma.inboundItem.findMany({ where: { inboundOrderId: id } });
          const spId = exists.subProjectId || null;
          for (const invItem of items_data) {
            const projectName = invItem.projectName || '待分配物资';
            const existing = await prisma.inventory.findFirst({
              where: { subProjectId: spId, materialId: invItem.materialId, projectName },
            });
            if (existing) {
              await prisma.inventory.update({
                where: { id: existing.id },
                data: { quantity: { increment: invItem.quantity }, isActive: true },
              });
            } else {
              await prisma.inventory.create({
                data: { tenantId, subProjectId: spId, materialId: invItem.materialId, projectName, quantity: invItem.quantity, outQuantity: 0 },
              });
            }
          }
          await prisma.inboundOrder.update({ where: { id }, data: { isActive: true } });
          restored.push(`入库单「${exists.orderNo}」`);
        } else if (type === 'outbound') {
          const exists = await prisma.outboundOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`出库单 ${id} 不存在或未删除`); continue; }
          // 恢复时回退库存（按 projectName 精确匹配）
          const items_data = await prisma.outboundItem.findMany({ where: { outboundOrderId: id } });
          const outSpId = exists.subProjectId || null;
          for (const outItem of items_data) {
            const inv = await prisma.inventory.findFirst({
              where: { subProjectId: outSpId, materialId: outItem.materialId, projectName: outItem.projectName || '待分配物资' },
            });
            if (inv) {
              await prisma.inventory.update({
                where: { id: inv.id },
                data: { quantity: { decrement: outItem.quantity } },
              });
            }
          }
          await prisma.outboundOrder.update({ where: { id }, data: { isActive: true } });
          restored.push(`出库单「${exists.orderNo}」`);
        } else if (type === 'return') {
          const exists = await prisma.returnOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`退库单 ${id} 不存在或未删除`); continue; }
          // 恢复时重新扣减库存
          const returnItems = await prisma.returnItem.findMany({ where: { returnOrderId: id }, include: { outboundItem: { select: { projectName: true } } } });
          for (const ri of returnItems) {
            await prisma.inventory.updateMany({
              where: { subProjectId: exists.subProjectId, materialId: ri.materialId, projectName: ri.outboundItem?.projectName || null },
              data: { quantity: { increment: ri.quantity } },
            });
          }
          await prisma.returnOrder.update({ where: { id }, data: { isActive: true } });
          restored.push(`退库单「${exists.orderNo}」`);
        } else if (type === 'transfer') {
          const exists = await prisma.transferOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`调拨单 ${id} 不存在或未删除`); continue; }
          // 恢复时重新执行调拨
          const transferItems = await prisma.transferItem.findMany({ where: { transferOrderId: id } });
          for (const ti of transferItems) {
            if (exists.fromSubProjectId) {
              await prisma.inventory.updateMany({
                where: { subProjectId: exists.fromSubProjectId, materialId: ti.materialId },
                data: { quantity: { decrement: ti.quantity } },
              });
            }
            if (exists.toSubProjectId) {
              await prisma.inventory.upsert({
                where: { subProjectId_materialId_projectName: { subProjectId: exists.toSubProjectId!, materialId: ti.materialId, projectName: null! } },
                create: { tenantId, subProjectId: exists.toSubProjectId, materialId: ti.materialId, quantity: ti.quantity, outQuantity: 0 },
                update: { quantity: { increment: ti.quantity } },
              });
            }
          }
          await prisma.transferOrder.update({ where: { id }, data: { isActive: true } });
          restored.push(`调拨单「${exists.orderNo}」`);
        }
      } catch (err: any) {
        errors.push(`项目 ${item.id}: ${err.message}`);
      }
    }

    await createLog({
      tenantId,
      userId: req.user!.id,
      action: 'RESTORE',
      module: 'recycle-bin',
      description: `从回收站恢复了 ${restored.length} 个项目`,
      detail: { restored, errors },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: { restored, errors },
      message: `成功恢复 ${restored.length} 个项目${errors.length ? `，${errors.length} 个失败` : ''}`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('恢复回收站项目失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '恢复失败' } as ApiResponse);
  }
});

/**
 * POST /api/recycle-bin/permanent-delete
 * 永久删除回收站项目
 *
 * 请求体：
 * - items: Array<{ id: string; type: string }> - 要永久删除的项目列表
 */
router.post('/permanent-delete', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { items } = req.body;

    if (!items?.length) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请指定要删除的项目' } as ApiResponse);
      return;
    }

    const deleted: string[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        const { id, type } = item;
        if (!id || !type) continue;

        if (type === 'contract') {
          const exists = await prisma.contract.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`合同 ${id} 不存在或未删除`); continue; }
          // 检查是否有依赖
          const deptCount = await prisma.department.count({ where: { contractId: id } });
          if (deptCount > 0) { errors.push(`合同「${exists.name}」下仍有 ${deptCount} 个项目部，请先删除项目部`); continue; }
          await prisma.contract.delete({ where: { id } });
          deleted.push(`合同「${exists.name}」`);
        } else if (type === 'inbound') {
          const exists = await prisma.inboundOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`入库单 ${id} 不存在或未删除`); continue; }
          await prisma.inboundItem.deleteMany({ where: { inboundOrderId: id } });
          await prisma.inboundOrder.delete({ where: { id } });
          deleted.push(`入库单「${exists.orderNo}」`);
        } else if (type === 'outbound') {
          const exists = await prisma.outboundOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`出库单 ${id} 不存在或未删除`); continue; }
          await prisma.outboundItem.deleteMany({ where: { outboundOrderId: id } });
          await prisma.outboundOrder.delete({ where: { id } });
          deleted.push(`出库单「${exists.orderNo}」`);
        } else if (type === 'return') {
          const exists = await prisma.returnOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`退库单 ${id} 不存在或未删除`); continue; }
          await prisma.returnItem.deleteMany({ where: { returnOrderId: id } });
          await prisma.returnOrder.delete({ where: { id } });
          deleted.push(`退库单「${exists.orderNo}」`);
        } else if (type === 'transfer') {
          const exists = await prisma.transferOrder.findFirst({ where: { id, tenantId, isActive: false } });
          if (!exists) { errors.push(`调拨单 ${id} 不存在或未删除`); continue; }
          await prisma.transferItem.deleteMany({ where: { transferOrderId: id } });
          await prisma.transferOrder.delete({ where: { id } });
          deleted.push(`调拨单「${exists.orderNo}」`);
        }
      } catch (err: any) {
        errors.push(`项目 ${item.id}: ${err.message}`);
      }
    }

    await createLog({
      tenantId,
      userId: req.user!.id,
      action: 'PERMANENT_DELETE',
      module: 'recycle-bin',
      description: `从回收站永久删除了 ${deleted.length} 个项目`,
      detail: { deleted, errors },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: { deleted, errors },
      message: `永久删除 ${deleted.length} 个项目${errors.length ? `，${errors.length} 个失败` : ''}`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('永久删除失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '永久删除失败' } as ApiResponse);
  }
});

export default router;
