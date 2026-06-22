// ============================================
// 操作日志服务（共享）
// ============================================
// 提供统一的日志记录功能，被各业务模块复用
// 最后更新：2026-04-30

import { prisma } from '../utils/prisma';

export interface CreateLogInput {
  tenantId: string;
  userId?: string;
  action: string;
  module: string;
  description: string;
  detail?: any;
  ip?: string;
  userAgent?: string;
}

export async function createLog(data: CreateLogInput): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        module: data.module,
        description: data.description,
        detail: data.detail ? JSON.parse(JSON.stringify(data.detail)) : undefined,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}
