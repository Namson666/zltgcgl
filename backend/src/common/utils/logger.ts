// ============================================
// 日志工具模块
// ============================================
// 提供操作日志记录功能，将用户的关键操作记录到数据库。
// 操作日志用于审计追踪和安全分析。
// 支持记录开发者操作和租户用户操作。
// ============================================

import { prisma } from './prisma';



/**
 * 记录操作日志
 *
 * 将用户的操作行为记录到数据库的 operation_logs 表中。
* 支持记录开发者操作和租户用户操作两种类型。
 *
 * 日志记录包含以下信息：
 * - 操作主体：开发者ID 或 租户用户ID
 * - 操作类型：创建、更新、删除、登录等
 * - 操作模块：物资管理、劳资管理、系统管理等
 * - 操作描述：简要描述操作内容
 * - 操作详情：可选的详细数据（如修改前后的数据快照）
 * - 请求信息：IP 地址和 User-Agent
 *
 * @param options - 日志记录参数
 * @param options.tenantId - 租户ID（租户用户操作时必填）
 * @param options.userId - 操作用户ID（租户用户操作时填写）
 * @param options.developerId - 开发者ID（开发者操作时填写）
 * @param options.action - 操作类型（LogAction 枚举值）
 *   可选值：CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, CONFIRM, CANCEL
 * @param options.module - 操作模块名称（如 '物资管理', '劳资管理', '系统管理'）
 * @param options.description - 操作描述（如 '创建入库单 #RK20260424001'）
 * @param options.detail - 操作详情（可选，如修改前后的数据快照 JSON）
 * @param options.ip - 客户端 IP 地址（可选）
 * @param options.userAgent - 客户端 User-Agent（可选）
 * @returns Promise<void> 异步写入数据库，不阻塞主流程
 *
 * @example
 * // 记录租户用户的创建操作
 * await logOperation({
 *   tenantId: 'tenant-uuid',
 *   userId: 'user-uuid',
 *   action: 'CREATE',
 *   module: '物资管理',
 *   description: '创建入库单 #RK20260424001',
 *   detail: { orderNo: 'RK20260424001', items: 5 },
 *   ip: '192.168.1.100',
 *   userAgent: 'Mozilla/5.0 ...'
 * });
 *
 * // 记录开发者的登录操作
 * await logOperation({
 *   developerId: 'dev-uuid',
 *   action: 'LOGIN',
 *   module: '系统管理',
 *   description: '开发者登录系统',
 *   ip: '10.0.0.1',
 * });
 *
 * // 记录数据导出操作（不等待结果）
 * logOperation({
 *   tenantId: 'tenant-uuid',
 *   userId: 'user-uuid',
 *   action: 'EXPORT',
 *   module: '劳资管理',
 *   description: '导出2026年3月工资表',
 * }).catch(err => console.error('日志记录失败:', err));
 */
export async function logOperation(options: {
  /** 租户ID（租户用户操作时必填） */
  tenantId?: string;
  /** 操作用户ID（租户用户操作时填写） */
  userId?: string;
  /** 开发者ID（开发者操作时填写） */
  developerId?: string;
  /** 操作类型（LogAction 枚举值） */
  action: string;
  /** 操作模块名称 */
  module: string;
  /** 操作描述 */
  description: string;
  /** 操作详情（可选，如修改前后的数据快照） */
  detail?: any;
  /** 客户端 IP 地址 */
  ip?: string;
  /** 客户端 User-Agent */
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        developerId: options.developerId || null,
        tenantId: options.tenantId || null,
        userId: options.userId || null,
        action: options.action,
        module: options.module,
        description: options.description,
        detail: options.detail ? JSON.parse(JSON.stringify(options.detail)) : undefined,
        ip: options.ip || null,
        userAgent: options.userAgent || null,
      },
    });
  } catch (error) {
    // 日志记录失败不应影响主业务流程，仅打印错误日志
    console.error('[操作日志] 记录失败:', error);
  }
}
