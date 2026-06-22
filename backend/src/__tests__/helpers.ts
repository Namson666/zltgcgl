// ============================================
// 测试辅助工具
// ============================================
// 提供测试环境初始化、Mock 工厂函数等
// 不修改任何现有业务代码
// ============================================

import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * 创建内存数据库的 Prisma 客户端实例
 * 用于集成测试中替代真实数据库
 */
export function createTestPrisma(): PrismaClient {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file::memory:?cache=shared',
      },
    },
    log: ['error'],
  });
  return prisma;
}

/**
 * 创建 Mock Prisma 客户端
 * 用于单元测试中模拟数据库操作
 * 返回一个带有所有常用方法（vi.fn()）的对象
 */
export function createMockPrisma() {
  const mockPrisma = {
    developer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    operationLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => {
      // 简单实现：将 mock 自身作为 tx 传入回调
      return fn(mockPrisma);
    }),
    $disconnect: vi.fn(),
  };

  return mockPrisma;
}

/**
 * 创建模拟的开发者数据
 */
export function createMockDeveloper(overrides: Record<string, any> = {}) {
  return {
    id: 'dev-test-001',
    username: 'admin',
    passwordHash: '$2a$10$hashedpasswordforunittesting',
    name: '测试管理员',
    email: 'admin@test.com',
    phone: '13800000000',
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 重置所有 vi.fn() mock 的调用记录
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}
