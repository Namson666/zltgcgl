// ============================================
// 全局错误处理中间件
// ============================================
// 统一捕获和处理所有路由中的错误，返回格式化的错误响应。
// 对 Prisma 数据库错误和 JWT 认证错误进行特殊处理，
// 提供更友好的错误信息。
// ============================================

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

/**
 * 自定义应用错误类
 *
 * 用于在业务逻辑中主动抛出带有状态码和错误信息的错误。
 * 全局错误处理中间件会识别此类错误并返回对应的响应。
 *
 * @example
 * // 在路由处理函数中抛出业务错误
 * if (!user) {
 *   throw new AppError(404, 'NOT_FOUND', '用户不存在');
 * }
 */
export class AppError extends Error {
  /** HTTP 状态码 */
  public statusCode: number;
  /** 错误代码（用于前端判断错误类型） */
  public errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = 'AppError';
  }
}

/**
 * 全局错误处理中间件
 *
 * Express 的错误处理中间件（4个参数），捕获所有未处理的错误。
 * 必须在所有路由之后注册。
 *
 * 处理逻辑：
 * 1. AppError：业务逻辑主动抛出的错误，直接使用其状态码和错误信息
 * 2. Prisma.PrismaClientKnownRequestError：数据库错误
 *    - P2002：唯一约束冲突（如用户名已存在）
 *    - P2025：记录未找到
 *    - P2003：外键约束失败
 *    - 其他：通用数据库错误
 * 3. JWT 错误：Token 过期或无效
 * 4. 其他未知错误：返回 500 服务器内部错误
 *
 * 在生产环境中，未知错误的详细信息不会返回给客户端，避免泄露敏感信息。
 *
 * @example
 * // 在 app.ts 中注册（必须放在所有路由之后）
 * app.use(errorHandler);
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 打印错误日志（生产环境可替换为日志系统）
  console.error(`[错误处理] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.error(`[错误信息] ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(`[错误堆栈] ${err.stack}`);
  }

  // 1. 处理自定义业务错误（AppError）
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.errorCode,
      message: err.message,
    });
    return;
  }

  // 2. 处理 Prisma 数据库错误
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  // 3. 处理 Prisma 数据库验证错误
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: '请求数据格式不正确',
    });
    return;
  }

  // 4. 处理 JWT 相关错误
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: '认证令牌已过期，请重新登录',
    });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: '认证令牌无效',
    });
    return;
  }

  // 5. 处理请求体过大错误
  if ((err as any).type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: '请求数据过大，请减少提交的数据量',
    });
    return;
  }

  // 6. 处理其他未知错误
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误，请稍后重试'
      : `服务器内部错误：${err.message}`,
  });
};

/**
 * 处理 Prisma 数据库错误
 *
 * 根据 Prisma 错误代码返回对应的友好错误信息。
 *
 * @param error - Prisma 客户端已知请求错误
 * @param res - Express 响应对象
 *
 * Prisma 错误代码说明：
 * - P2002: 唯一约束冲突（字段值重复）
 * - P2025: 记录未找到
 * - P2003: 外键约束失败（关联记录不存在）
 * - P2001: 记录不存在（查询条件未匹配）
 * - P2014: 关联记录不存在（违反必需关联）
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError, res: Response): void {
  switch (error.code) {
    case 'P2002': {
      // 唯一约束冲突：某个字段的值已存在
      // 尝试从错误元数据中提取冲突的字段名
      const target = (error.meta?.target as string[]) || [];
      const fieldNames = target.join('、');

      res.status(409).json({
        success: false,
        error: 'DUPLICATE_ENTRY',
        message: fieldNames
          ? `${fieldNames} 已存在，请使用其他值`
          : '数据重复，该记录已存在',
      });
      break;
    }

    case 'P2025': {
      // 记录未找到
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '请求的记录不存在或已被删除',
      });
      break;
    }

    case 'P2003': {
      // 外键约束失败：关联的记录不存在
      const fieldName = error.meta?.field_name as string || '关联字段';
      res.status(400).json({
        success: false,
        error: 'FOREIGN_KEY_CONSTRAINT',
        message: `关联数据不存在：${fieldName}`,
      });
      break;
    }

    case 'P2001': {
      // 查询条件未匹配到任何记录
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '未找到符合条件的数据',
      });
      break;
    }

    case 'P2014': {
      // 违反必需关联约束
      res.status(400).json({
        success: false,
        error: 'RELATION_REQUIRED',
        message: '缺少必需的关联数据',
      });
      break;
    }

    default: {
      // 其他未处理的 Prisma 错误
      console.error(`[Prisma 错误] 代码: ${error.code}, 信息: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '数据库操作失败，请稍后重试',
      });
      break;
    }
  }
}
