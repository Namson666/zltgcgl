// ============================================
// 租户隔离中间件
// ============================================
// 确保请求在正确的租户上下文中执行。
// 从认证用户信息中提取 tenantId，挂载到请求对象上，
// 供后续业务逻辑使用，实现多租户数据隔离。
// ============================================

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * 租户隔离中间件
 *
 * 确保当前请求的用户信息中包含有效的 tenantId，
 * 并将其挂载到 req.tenantId 上，供后续业务逻辑使用。
 *
 * 验证逻辑：
 * 1. 开发者视角模式（isDevView === true）：使用 Token 中的 tenantId
 * 2. 租户用户（type === 'user'）：使用用户关联的 tenantId
 * 3. 普通开发者（无 isDevView）：拒绝访问，因为开发者需要指定租户
 *
 * 使用时需先经过 authenticate 中间件。
 *
 * @example
 * // 所有租户业务路由都需要租户隔离
 * app.get('/api/inventory', authenticate, ensureTenantIsolation, handler);
 *
 * // 在路由处理函数中通过 req.tenantId 获取租户ID
 * app.get('/api/users', authenticate, ensureTenantIsolation, (req: AuthenticatedRequest, res) => {
 *   const users = await prisma.user.findMany({ where: { tenantId: req.tenantId } });
 *   res.json({ success: true, data: users });
 * });
 */
export const ensureTenantIsolation = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // 从用户信息中获取 tenantId
  const tenantId = req.user!.tenantId;

  // 检查 tenantId 是否存在
  if (!tenantId) {
    res.status(403).json({
      success: false,
      error: 'TENANT_REQUIRED',
      message: '缺少租户信息，无法确定数据归属。请确保您的账户已关联到有效的企业。',
    });
    return;
  }

  // 将 tenantId 挂载到请求对象上，方便后续中间件和路由使用
  req.tenantId = tenantId;

  // 继续后续处理
  next();
};
