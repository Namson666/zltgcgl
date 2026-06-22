// ============================================
// 共享 TypeScript 类型定义
// ============================================
// 本文件定义了整个后端系统中通用的类型接口，
// 包括 JWT 载荷、API 响应格式、分页响应、认证请求等。
// 所有模块都应引用此文件中的类型，确保类型一致性。
// ============================================

import { Request } from 'express';

/**
 * JWT 载荷接口
 *
 * 描述了 JWT Token 中携带的用户身份信息。
 * 系统支持两种用户类型：
 * - developer: 平台开发者/超级管理员
 * - user: 租户企业用户
 *
 * @property id - 用户唯一标识（UUID）
 * @property type - 用户类型，'developer' 表示平台开发者，'user' 表示租户用户
 * @property tenantId - 租户ID（仅 user 类型有值，表示所属企业）
 * @property departmentId - 所属项目部ID（仅 user 类型可能有值）
 * @property role - 用户角色名称（仅 user 类型有值，如 'admin', 'material' 等）
 * @property dataScope - 数据范围（仅 user 类型有值，控制可见数据范围）
 * @property permissions - 用户权限字段列表（仅 user 类型有值）
 * @property isDevView - 是否为开发者视角模式（开发者以租户身份查看数据时为 true）
 */
export interface JwtPayload {
  /** 用户唯一标识（UUID） */
  id: string;
  /** 用户类型：'developer' 平台开发者 | 'user' 租户用户 */
  type: 'developer' | 'user';
  /** 租户ID，仅 user 类型有值，表示所属施工企业 */
  tenantId?: string;
  /** 所属项目部ID，仅 user 类型可能有值 */
  departmentId?: string;
  /** 用户角色名称，如 'admin', 'material', 'labor' 等 */
  role?: string;
  /** 数据范围，控制用户可见的数据范围 */
  dataScope?: string;
  /** 用户拥有的权限字段列表 */
  permissions?: string[];
  /** 是否为开发者视角模式（开发者模拟租户身份查看） */
  isDevView?: boolean;
}

/**
 * 通用 API 响应接口
 *
 * 所有 API 接口返回数据的统一格式。
 * 成功时 success 为 true，data 中包含返回数据；
 * 失败时 success 为 false，error 中包含错误信息。
 *
 * @property success - 请求是否成功
 * @property data - 成功时返回的数据（可选）
 * @property error - 失败时的错误信息（可选）
 * @property message - 附加提示信息（可选）
 *
 * @example
 * // 成功响应
 * { success: true, data: { id: 'xxx', name: '张三' }, message: '查询成功' }
 * // 失败响应
 * { success: false, error: 'NOT_FOUND', message: '用户不存在' }
 */
export interface ApiResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 成功时返回的数据 */
  data?: T;
  /** 失败时的错误代码 */
  error?: string;
  /** 附加提示信息 */
  message?: string;
}

/**
 * 分页响应接口
 *
 * 用于列表查询接口的返回格式，包含数据和分页信息。
 * 分页信息帮助前端渲染分页组件。
 *
 * @property success - 请求是否成功
 * @property data - 当前页的数据列表
 * @property pagination - 分页元信息
 * @property pagination.page - 当前页码（从 1 开始）
 * @property pagination.pageSize - 每页记录数
 * @property pagination.total - 总记录数
 * @property pagination.totalPages - 总页数
 *
 * @example
 * {
 *   success: true,
 *   data: [{ id: '1', name: '项目A' }, { id: '2', name: '项目B' }],
 *   pagination: { page: 1, pageSize: 10, total: 25, totalPages: 3 }
 * }
 */
export interface PaginatedResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 当前页的数据列表 */
  data: T[];
  /** 分页元信息 */
  pagination: {
    /** 当前页码（从 1 开始） */
    page: number;
    /** 每页记录数 */
    pageSize: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

/**
 * 认证请求接口
 *
 * 扩展 Express.Request，在请求对象上挂载已认证的用户信息。
 * 经过 authenticate 中间件处理后，req.user 将包含 JWT 解析后的用户身份。
 *
 * @property user - JWT 解析后的用户身份信息
 *
 * @example
 * // 在路由处理函数中使用
 * app.get('/profile', authenticate, (req: AuthenticatedRequest, res) => {
 *   res.json({ success: true, data: { userId: req.user!.id } });
 * });
 */
export interface AuthenticatedRequest extends Request {
  /** 已认证的用户信息（由 authenticate 中间件注入） */
  user?: JwtPayload;
  /** 当前请求关联的租户ID（由 ensureTenantIsolation 中间件注入） */
  tenantId?: string;
}
