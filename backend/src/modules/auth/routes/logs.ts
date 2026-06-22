// ============================================
// 操作日志路由模块
// ============================================
// 本文件定义了操作日志查询相关的 API 路由。
// 操作日志记录了系统中所有关键操作（登录、创建、更新、删除等），
// 用于审计追踪和安全监控。
//
// 数据隔离规则：
// - 开发者（type === 'developer'）：可以查看所有操作日志
// - 租户用户（type === 'user'）：只能查看本企业的操作日志
//
// 支持的筛选条件：
// - 分页（page、pageSize）
// - 按模块筛选（module）
// - 按操作类型筛选（action）
// - 按时间范围筛选（startDate、endDate）
// ============================================

import { Router, Response } from 'express';
import { prisma } from '../../../common/utils/prisma';

// 导入认证中间件
import { authenticate } from '../../../common/middleware/auth';

import { AuthenticatedRequest, PaginatedResponse } from '../../../common/types';



/**
 * 创建 Express 路由器实例
 */
const router = Router();

// ============================================
// 路由定义
// ============================================

/**
 * GET /api/logs
 * 获取操作日志列表
 *
 * 根据当前用户身份自动过滤日志范围：
 * - 开发者：查看全部日志
 * - 租户用户：仅查看本企业日志
 *
 * 查询参数（Query String）：
 * - page: number - 页码，默认 1
 * - pageSize: number - 每页记录数，默认 20，最大 100
 * - module: string - 按操作模块筛选（如 'auth'、'contract'、'department'）
 * - action: string - 按操作类型筛选（如 'LOGIN'、'CREATE'、'UPDATE'、'DELETE'）
 * - startDate: string - 起始时间（ISO 8601 格式，如 '2026-01-01'）
 * - endDate: string - 结束时间（ISO 8601 格式，如 '2026-12-31'）
 *
 * 请求头：Authorization: Bearer <token>
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // ---- 解析查询参数 ----

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page as string) || 1); // 页码，最小为 1
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20)); // 每页记录数，限制在 1~100

    // 筛选条件
    const moduleFilter = req.query.module as string | undefined; // 操作模块筛选
    const actionFilter = req.query.action as string | undefined; // 操作类型筛选
    const startDate = req.query.startDate as string | undefined; // 起始时间
    const endDate = req.query.endDate as string | undefined; // 结束时间

    // ---- 构建 Prisma 查询条件 ----

    // where 条件对象，根据参数动态构建
    const where: any = {};

    // 数据隔离：根据用户类型限制可见日志范围
    if (req.user!.type === 'developer') {
      // 开发者可以查看所有日志（包括开发者操作和租户操作）
      // 不添加 tenantId 过滤条件
    } else if (req.user!.type === 'user') {
      // 租户用户只能查看本企业的日志
      where.tenantId = req.user!.tenantId;
    }

    // 按模块筛选（精确匹配 OperationLog.module 字段）
    if (moduleFilter) {
      where.module = moduleFilter;
    }

    // 按操作类型筛选（精确匹配 OperationLog.action 枚举字段）
    if (actionFilter) {
      // 验证 action 值是否为有效的 LogAction 枚举值
      const validActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'CONFIRM', 'CANCEL'];
      if (validActions.includes(actionFilter)) {
        where.action = actionFilter;
      }
    }

    // 按时间范围筛选（基于 OperationLog.createdAt 字段）
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate); // 大于等于起始时间
      }
      if (endDate) {
        // 结束时间设置为当天 23:59:59.999，确保包含当天所有记录
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime; // 小于等于结束时间
      }
    }

    // ---- 执行数据库查询 ----

    // 并行执行：总记录数查询和数据列表查询
    const [total, logs] = await Promise.all([
      // 查询符合条件的总记录数（用于分页计算）
      prisma.operationLog.count({ where }),

      // 查询当前页的日志数据
      // 按创建时间倒序排列（最新的日志在前）
      prisma.operationLog.findMany({
        where,
        // 分页：跳过 (page-1)*pageSize 条，取 pageSize 条
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc', // 按时间倒序
        },
        // 关联查询操作者信息
        include: {
          // 开发者信息（开发者操作时有关联）
          developer: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          // 租户信息
          tenant: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          // 用户信息（租户用户操作时有关联）
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      }),
    ]);

    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);

    // ---- 返回分页结果 ----
    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取操作日志过程中发生服务器错误',
    });
  }
});

// ============================================
// 导出路由器
// ============================================
export default router;
