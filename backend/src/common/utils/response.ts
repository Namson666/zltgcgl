// ============================================
// 统一 API 响应工具函数
// ============================================
// 提供标准化的成功/错误响应方法，确保所有 API 接口
// 返回格式一致：{ success, data?, error?, message? }
// ============================================

import { Response } from 'express';
import { ApiResponse } from '../types';

/**
 * 发送成功响应
 *
 * @param res - Express Response 对象
 * @param data - 返回的数据
 * @param message - 可选的附加提示信息
 * @param statusCode - HTTP 状态码，默认 200
 */
export function successResp<T>(res: Response, data: T, message?: string, statusCode: number = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  if (message) {
    body.message = message;
  }
  res.status(statusCode).json(body);
}

/**
 * 发送错误响应
 *
 * @param res - Express Response 对象
 * @param status - HTTP 状态码
 * @param code - 业务错误代码（如 'NOT_FOUND', 'INVALID_PARAMS'）
 * @param message - 错误描述信息
 */
export function errorResp(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({
    success: false,
    error: code,
    message,
  } as ApiResponse);
}

/**
 * 常用错误响应快捷方法
 */
export const errors = {
  /** 400 参数验证失败 */
  badRequest: (res: Response, message: string = '请求参数错误') =>
    errorResp(res, 400, 'BAD_REQUEST', message),

  /** 401 未认证 */
  unauthorized: (res: Response, message: string = '未认证，请先登录') =>
    errorResp(res, 401, 'UNAUTHORIZED', message),

  /** 403 无权限 */
  forbidden: (res: Response, message: string = '无权限访问该资源') =>
    errorResp(res, 403, 'FORBIDDEN', message),

  /** 404 资源不存在 */
  notFound: (res: Response, message: string = '请求的资源不存在') =>
    errorResp(res, 404, 'NOT_FOUND', message),

  /** 409 资源冲突 */
  conflict: (res: Response, message: string = '资源已存在或存在冲突') =>
    errorResp(res, 409, 'CONFLICT', message),

  /** 500 服务器内部错误 */
  internal: (res: Response, message: string = '服务器内部错误') =>
    errorResp(res, 500, 'INTERNAL_ERROR', message),
};
