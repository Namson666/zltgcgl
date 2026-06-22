// ============================================
// 认证中间件
// ============================================
// 提供用户身份认证和角色验证功能。
// 所有需要身份验证的路由都必须先经过 authenticate 中间件。
// 支持开发者、租户用户两种身份类型的验证。
// ============================================

import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthenticatedRequest, JwtPayload } from '../types';

/**
 * 认证中间件
 *
 * 从请求的 Authorization Header 中提取 Bearer Token，
 * 验证 Token 的有效性，并将解析后的用户信息挂载到 req.user。
 *
 * 使用方式：
 * - 请求头格式：Authorization: Bearer <token>
 * - 验证成功：将用户信息挂载到 req.user，调用 next() 继续后续处理
 * - 验证失败：返回 401 Unauthorized 错误
 *
 * @example
 * // 保护路由
 * app.get('/api/profile', authenticate, (req, res) => {
 *   res.json({ userId: req.user!.id });
 * });
 */
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // 从请求头中获取 Authorization 字段
    const authHeader = req.headers.authorization;

    // 检查 Authorization 头是否存在
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '缺少认证令牌，请在请求头中提供 Authorization: Bearer <token>',
      });
      return;
    }

    // 提取 Bearer Token（格式：Bearer <token>）
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '认证令牌格式错误，正确格式为：Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // 验证 Token 并解析用户信息
    const decoded = verifyToken(token);

    // 将解析后的用户信息挂载到请求对象
    req.user = decoded;

    // 继续后续中间件或路由处理
    next();
  } catch (error: any) {
    // 处理 JWT 过期错误
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: '认证令牌已过期，请重新登录',
      });
      return;
    }

    // 处理其他 JWT 验证错误（无效 Token、签名错误等）
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: '认证令牌无效，请重新登录',
    });
  }
};

/**
 * 开发者权限中间件
 *
 * 仅允许平台开发者（type === 'developer'）访问。
 * 通常用于开发者后台管理接口。
 *
 * 使用时需先经过 authenticate 中间件。
 *
 * @example
 * // 仅开发者可访问的路由
 * app.get('/api/admin/tenants', authenticate, requireDeveloper, handler);
 */
export const requireDeveloper = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user?.type !== 'developer') {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: '该接口仅限平台开发者访问',
    });
    return;
  }

  next();
};

/**
 * 租户用户权限中间件
 *
 * 仅允许租户用户（type === 'user'）访问。
 * 用于租户侧的业务功能接口。
 *
 * 特殊支持：开发者视角模式（isDevView === true）也允许通过，
 * 因为 dev-view token 包含 tenantId，且开发者需要查看企业数据。
 *
 * @example
 * // 仅租户用户可访问的路由
 * app.get('/api/inventory', authenticate, requireUser, handler);
 */
export const requireUser = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // 开发者视角模式（isDevView === true）允许通过
  if (req.user?.isDevView) {
    if (!req.user!.tenantId) {
      res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: '开发者视角令牌缺少租户信息，请重新进入企业视角',
      });
      return;
    }
    next();
    return;
  }

  // 兼容通过 refresh 续期的 dev-view token（isDevView 可能在续期时丢失，但 tenantId 仍然保留）
  if (req.user?.type === 'developer' && req.user!.tenantId) {
    next();
    return;
  }

  if (req.user?.type !== 'user') {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: '该接口仅限租户用户访问',
    });
    return;
  }

  // 确保租户用户有 tenantId（防止 token 数据不完整）
  if (!req.user!.tenantId) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: '认证令牌缺少租户信息，请重新登录',
    });
    return;
  }

  next();
};

/**
 * 角色验证中间件工厂函数
 *
 * 创建一个中间件，仅允许具有指定角色的用户访问。
 * 支持传入多个角色名称，只要用户角色匹配其中之一即可通过。
 *
 * @param roles - 允许访问的角色名称列表（可变参数）
 * @returns Express 中间件函数
 *
 * @example
 * // 仅允许 admin 和 boss 角色访问
 * app.post('/api/users', authenticate, requireRoles('admin', 'boss'), handler);
 *
 * // 仅允许 material 角色访问
 * app.post('/api/inbound', authenticate, requireRoles('material'), handler);
 */
export const requireRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // 开发者直接放行（开发者拥有所有权限）
    if (req.user?.type === 'developer') {
      next();
      return;
    }

    // 检查用户角色是否在允许的角色列表中
    const userRole = req.user!.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `权限不足，该接口需要以下角色之一：${roles.join('、')}`,
      });
      return;
    }

    next();
  };
};
