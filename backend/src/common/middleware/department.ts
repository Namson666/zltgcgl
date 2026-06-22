// ============================================
// 项目部隔离中间件
// ============================================
// 确保用户只能访问其被授权的项目部数据。
// 根据用户的数据范围（dataScope）进行不同级别的访问控制：
// - ALL: 可访问所有项目部
// - DEPARTMENTS: 仅可访问被授权的项目部列表
// - OWN_DEPARTMENT: 仅可访问所属项目部
// ============================================

import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';



/**
 * 项目部访问控制中间件工厂函数
 *
 * 创建一个中间件，验证当前用户是否有权访问指定的项目部。
 * 根据用户的数据范围（dataScope）执行不同的验证逻辑：
 *
 * 1. 开发者（type === 'developer'）：直接放行
 * 2. dataScope === 'ALL'：放行，可访问租户下所有项目部
 * 3. dataScope === 'DEPARTMENTS'：查询 DepartmentAuthorization 表，
 *    检查目标项目部是否在用户的授权列表中
 * 4. dataScope === 'OWN_DEPARTMENT'：检查目标项目部是否与用户所属项目部一致
 *
 * @param departmentIdFromParam - 从请求参数中获取项目部ID的参数名
 *   默认值为 'departmentId'，即从 req.params.departmentId 获取
 *   也可以设置为 'id'，即从 req.params.id 获取
 * @returns Express 中间件函数
 *
 * @example
 * // 从路由参数 departmentId 获取项目部ID
 * app.get('/api/departments/:departmentId/info', authenticate, ensureTenantIsolation,
 *   ensureDepartmentAccess('departmentId'), handler);
 *
 * // 从路由参数 id 获取项目部ID
 * app.put('/api/departments/:id', authenticate, ensureTenantIsolation,
 *   ensureDepartmentAccess('id'), handler);
 *
 * // 使用默认参数名 'departmentId'
 * app.get('/api/departments/:departmentId/inventory', authenticate, ensureTenantIsolation,
 *   ensureDepartmentAccess(), handler);
 */
export const ensureDepartmentAccess = (departmentIdFromParam: string = 'departmentId') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 开发者直接放行（平台开发者可访问所有项目部）
      if (req.user!.type === 'developer') {
        next();
        return;
      }

      // 从路由参数中获取目标项目部ID
      const targetDepartmentId = req.params[departmentIdFromParam];

      // 如果没有提供项目部ID参数，直接放行（可能是列表查询等不需要指定项目部的接口）
      if (!targetDepartmentId) {
        next();
        return;
      }

      // 获取用户的数据范围
      const dataScope = req.user!.dataScope;

      // 如果用户没有 dataScope 信息，默认为最严格的 OWN_DEPARTMENT
      if (!dataScope) {
        // 检查用户所属项目部是否匹配
        if (req.user!.departmentId === targetDepartmentId) {
          next();
          return;
        }

        res.status(403).json({
          success: false,
          error: 'DEPARTMENT_ACCESS_DENIED',
          message: '您没有访问该项目部的权限',
        });
        return;
      }

      // 根据数据范围进行验证
      switch (dataScope) {
        case 'ALL':
          // 全企业数据范围：可访问所有项目部，直接放行
          next();
          break;

        case 'DEPARTMENTS': {
          // 授权项目部列表：查询 DepartmentAuthorization 表
          const authorization = await prisma.departmentAuthorization.findUnique({
            where: {
              userId_departmentId: {
                userId: req.user!.id,
                departmentId: targetDepartmentId,
              },
            },
          });

          if (!authorization) {
            res.status(403).json({
              success: false,
              error: 'DEPARTMENT_ACCESS_DENIED',
              message: '您没有被授权访问该项目部',
            });
            return;
          }

          next();
          break;
        }

        case 'OWN_DEPARTMENT':
        default: {
          // 仅所属项目部：检查用户所属项目部是否匹配目标项目部
          if (req.user!.departmentId !== targetDepartmentId) {
            res.status(403).json({
              success: false,
              error: 'DEPARTMENT_ACCESS_DENIED',
              message: '您只能访问所属项目部的数据',
            });
            return;
          }

          next();
          break;
        }
      }
    } catch (error: any) {
      console.error('项目部权限验证出错:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '项目部权限验证过程中发生错误',
      });
    }
  };
};
