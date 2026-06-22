// ============================================
// 权限中间件
// ============================================
// 提供细粒度的功能权限验证。
// 通过查询数据库中的 Permission 记录，检查用户是否具有指定权限。
// 开发者和 admin 角色默认拥有所有权限，直接放行。
// ============================================

import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';



/**
 * 权限验证中间件工厂函数
 *
 * 创建一个中间件，验证当前用户是否拥有指定的功能权限。
 * 验证逻辑：
 * 1. 开发者（type === 'developer'）直接放行
 * 2. admin 角色（role === 'admin'）直接放行
 * 3. 其他角色：从数据库查询该用户角色关联的 Permission 记录，
 *    检查对应权限字段是否为 true
 *
 * @param permissionField - 要检查的权限字段名，对应 Permission 模型中的字段
 *   常用权限字段：
 *   - canViewDashboard: 查看数据看板
 *   - canManageSystem: 系统管理
 *   - canViewLogs: 查看操作日志
 *   - canExport: 导出数据
 *   - canViewInventory: 查看库存
 *   - canInbound: 入库操作
 *   - canOutbound: 出库操作
 *   - canReturn: 退库操作
 *   - canTransfer: 调拨操作
 *   - canViewRecords: 查看记录
 *   - canViewWorkTeamLedger: 查看班组台账
 *   - canManagePersonnel: 人员管理
 *   - canManageAttendance: 考勤管理
 *   - canManageSalary: 工资核算
 *   - canManagePayment: 工资发放
 *   - canManageAnomaly: 风控管理
 *   - canManageReport: 报表导出
 *   - canManageContract: 合同管理
 *   - canManageDepartment: 项目部管理
 * @returns Express 中间件函数
 *
 * @example
 * // 仅允许有入库权限的用户访问
 * app.post('/api/inbound', authenticate, requirePermission('canInbound'), handler);
 *
 * // 仅允许有工资核算权限的用户访问
 * app.get('/api/salary', authenticate, requirePermission('canManageSalary'), handler);
 */
export const requirePermission = (permissionField: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 开发者直接放行（平台开发者拥有所有权限）
      if (req.user!.type === 'developer') {
        next();
        return;
      }

      // admin 角色直接放行（企业管理员拥有所有权限）
      if (req.user!.role === 'admin' || req.user!.role === 'boss') {
        next();
        return;
      }

      // 确保用户有角色ID（通过 JWT 载荷中的 roleId 查询）
      // 注意：需要在 authenticate 中间件中确保 roleId 被包含在 Token 中
      // 这里通过用户ID查询其角色信息
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          roleId: true,
          role: {
            select: {
              permissions: true,
            },
          },
        },
      });

      // 用户不存在或没有角色
      if (!user || !user.role) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '用户角色信息异常，无法验证权限',
        });
        return;
      }

      // 获取该角色的权限配置
      const permission = user.role.permissions;

      if (!permission) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '未找到角色权限配置',
        });
        return;
      }

      // 检查指定权限字段是否为 true
      // role.permissions 返回 Permission[] 数组，需取第一个元素
      const hasPermission = (permission?.[0] as Record<string, any>)?.[permissionField] === true;

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: 'PERMISSION_DENIED',
          message: `权限不足，您没有执行此操作的权限（需要：${permissionField}）`,
        });
        return;
      }

      // 权限验证通过
      next();
    } catch (error: any) {
      console.error('权限验证出错:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '权限验证过程中发生错误',
      });
    }
  };
};
