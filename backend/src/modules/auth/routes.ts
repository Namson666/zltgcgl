// ============================================
// 认证路由模块
// ============================================
// 本文件定义了系统认证相关的所有 API 路由，包括：
// 1. 开发者登录 - 平台管理员登录
// 2. 租户用户登录 - 企业用户登录
// 3. 修改密码 - 通用密码修改接口
// 4. 获取当前用户信息 - 通过 Token 获取用户详情
// 5. 开发者进入企业视角 - 开发者模拟租户身份
// 6. 开发者退出企业视角 - 开发者退出模拟模式
//
// 所有登录接口使用 bcryptjs 验证密码，登录成功后返回 JWT Token。
// 关键操作（登录、修改密码等）会记录操作日志。
// ============================================

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../common/utils/prisma';
import { getTenantEnabledModules, TENANT_MODULE_KEYS } from '../../common/services/module-entitlement.service';
import { findEnabledPortalByHost, getPublicPortalConfigByHost } from '../../common/services/tenant-portal.service';

// 导入 JWT 工具函数
import { signToken, signDevViewToken, storeRefreshToken, verifyAndConsumeRefreshToken } from '../../common/utils/jwt';

// 导入认证中间件
import { authenticate } from '../../common/middleware/auth';

// 导入类型定义
import { AuthenticatedRequest, ApiResponse } from '../../common/types';



/**
 * 创建 Express 路由器实例
 */
const router = Router();

/**
 * GET /api/auth/portal-config?hostname=tenant.example.com
 * 独立登录页公开配置查询。仅返回展示信息，不返回企业代码。
 */
router.get('/portal-config', async (req: Request, res: Response): Promise<void> => {
  try {
    const hostname = (req.query.hostname as string | undefined) || req.hostname || req.headers.host;
    const config = await getPublicPortalConfigByHost(hostname);
    res.json({
      success: true,
      data: config || { isEnabled: false },
    } as ApiResponse);
  } catch (error: any) {
    console.error('获取独立登录页配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取独立登录页配置失败',
    } as ApiResponse);
  }
});

// ============================================
// 辅助函数
// ============================================

/**
 * 记录操作日志的辅助函数
 *
 * 将操作记录写入 OperationLog 表，用于审计追踪。
 * 支持开发者操作和租户用户操作两种日志类型。
 *
 * @param data - 日志数据
 * @param data.developerId - 开发者ID（开发者操作时传入）
 * @param data.tenantId - 租户ID（租户用户操作时传入）
 * @param data.userId - 用户ID（租户用户操作时传入）
 * @param data.action - 操作类型（登录、登出、更新等）
 * @param data.module - 操作模块（如 'auth'、'system'）
 * @param data.description - 操作描述
 * @param data.detail - 操作详情（JSON格式，可选）
 * @param data.ip - 客户端IP地址（可选）
 * @param data.userAgent - 客户端User-Agent（可选）
 */
async function createLog(data: {
  developerId?: string;
  tenantId?: string;
  userId?: string;
  action: string;
  module: string;
  description: string;
  detail?: any;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        developerId: data.developerId,
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
    // 日志记录失败不应影响主流程，仅打印错误
    console.error('记录操作日志失败:', error);
  }
}

// ============================================
// 路由定义
// ============================================

/**
 * POST /api/auth/developer/login
 * 开发者登录接口
 *
 * 验证开发者用户名和密码，登录成功后返回 JWT Token 和开发者基本信息。
 * 同时更新最后登录时间，并记录操作日志。
 *
 * 请求体：
 * - username: string - 开发者用户名
 * - password: string - 开发者密码
 *
 * 响应：
 * - token: string - JWT 认证令牌
 * - user: object - 开发者基本信息（不含密码）
 */
router.post('/developer/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // 从请求体中获取用户名和密码
    const { username, password } = req.body;

    // 参数校验：用户名和密码为必填项
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: '用户名和密码不能为空',
      } as ApiResponse);
      return;
    }

    // 在数据库中查找开发者记录
    // 使用 username 作为唯一标识查询 Developer 表
    const developer = await prisma.developer.findUnique({
      where: { username },
    });

    // 开发者不存在
    if (!developer) {
      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      } as ApiResponse);
      return;
    }

    // 检查开发者账户是否已被停用
    if (!developer.isActive) {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: '该开发者账户已被停用，请联系管理员',
      } as ApiResponse);
      return;
    }

    // 使用 bcryptjs 比对密码哈希值
    // compare 方法会自动处理 salt，安全地验证密码
    const isPasswordValid = await bcrypt.compare(password, developer.passwordHash);

    // 密码验证失败
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      } as ApiResponse);
      return;
    }

    // 签发 JWT Token（短期）
    const token = signToken({
      id: developer.id,
      type: 'developer',
    });
    // 签发长期凭证（30天）
    const refreshToken = await storeRefreshToken({ userId: developer.id, userType: 'developer' });

    // 更新最后登录时间（非阻塞，失败不影响登录）
    try {
      await prisma.developer.update({
        where: { id: developer.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (updateErr) {
      console.warn('[WARN] 更新开发者最后登录时间失败（不影响登录）:', updateErr);
    }

    // 记录登录操作日志
    await createLog({
      developerId: developer.id,
      action: 'LOGIN',
      module: 'auth',
      description: `开发者 ${developer.name} 登录系统`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // 返回 Token 和开发者信息（排除密码哈希等敏感字段）
    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: developer.id,
          username: developer.username,
          name: developer.name,
          email: developer.email,
          phone: developer.phone,
          isActive: developer.isActive,
          lastLoginAt: developer.lastLoginAt,
        },
      },
      message: '登录成功',
    } as ApiResponse);
  } catch (error: any) {
    // 捕获未预期的服务端错误
    console.error('开发者登录失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '登录过程中发生服务器错误',
    } as ApiResponse);
  }
});

/**
 * POST /api/auth/user/login
 * 租户用户登录接口
 *
 * 验证企业代码、用户名和密码，登录成功后返回 JWT Token 和用户信息。
 * 需要先通过企业代码（tenantCode）定位租户，再在租户内查找用户。
 *
 * 请求体：
 * - tenantCode: string - 企业代码（Tenant.code）
 * - username: string - 用户名
 * - password: string - 密码
 *
 * 响应：
 * - token: string - JWT 认证令牌
 * - user: object - 用户信息（含角色、权限、数据范围等）
 */
router.post('/user/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // 从请求体中获取登录参数
    const { tenantCode, username, password, portalHost } = req.body;
    // 参数校验：三个字段均为必填
    if ((!tenantCode && !portalHost) || !username || !password) {
      res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: '企业代码或独立登录域名、用户名和密码不能为空',
      } as ApiResponse);
      return;
    }

    // 第一步：通过企业代码或独立登录域名查找租户
    const portal = tenantCode ? null : await findEnabledPortalByHost(portalHost || req.hostname || req.headers.host);
    const tenant = tenantCode
      ? await prisma.tenant.findUnique({ where: { code: tenantCode } })
      : portal?.tenant || null;

    // 租户不存在
    if (!tenant) {
      res.status(401).json({
        success: false,
        error: 'INVALID_TENANT',
        message: tenantCode ? '企业代码无效，请检查后重试' : '独立登录域名无效或未启用，请联系管理员',
      } as ApiResponse);
      return;
    }

    // 检查租户是否已被停用
    if (!tenant.isActive) {
      res.status(403).json({
        success: false,
        error: 'TENANT_DISABLED',
        message: '该企业已被停用，请联系平台管理员',
      } as ApiResponse);
      return;
    }

    // 第二步：在租户内查找用户
    // 使用 @@unique([tenantId, username]) 复合唯一索引查询
    const user = await prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId: tenant.id,
          username,
        },
      },
      include: {
        // 关联查询角色信息，用于返回权限数据
        role: {
          include: {
            permissions: true,
          },
        },
        // 关联查询所属项目部信息
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // 用户不存在
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      } as ApiResponse);
      return;
    }

    // 检查用户是否已被停用
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: '该用户已被停用，请联系企业管理员',
      } as ApiResponse);
      return;
    }

    // 使用 bcryptjs 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    // 密码验证失败
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      } as ApiResponse);
      return;
    }

    // 从角色权限中提取权限字段列表
    // 仅收集值为 true 的权限字段名，用于前端权限判断
    const permissionFields = user.role?.permissions
      ? Object.entries(user.role.permissions)
          .filter(([, value]: [string, any]) => value === true)
          .map(([key]) => key)
      : [];

    const enabledModules = await getTenantEnabledModules(user.tenantId);

    // 签发 JWT Token（短期）+ 长期凭证
    const token = signToken({
      id: user.id,
      type: 'user',
      tenantId: user.tenantId,
      departmentId: user.departmentId || undefined,
      role: user.role?.name,
      dataScope: user.dataScope,
      permissions: permissionFields,
    });
    // 签发长期凭证（30天）
    const refreshToken = await storeRefreshToken({ userId: user.id, userType: 'user', tenantId: user.tenantId });

    // 更新用户最后登录时间（非阻塞，失败不影响登录）
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (updateErr) {
      console.warn('[WARN] 更新最后登录时间失败（不影响登录）:', updateErr);
    }

    // 记录登录操作日志
    await createLog({
      tenantId: tenant.id,
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      description: `用户 ${user.name} 登录系统（企业：${tenant.name}）`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // 返回 Token 和用户完整信息（排除密码哈希等敏感字段）
    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          tenantId: user.tenantId,
          tenantName: tenant.name,
          departmentId: user.departmentId,
          department: user.department,
          username: user.username,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role?.name,
          displayName: user.role?.displayName,
          dataScope: user.dataScope,
          permissions: permissionFields,
          enabledModules,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
        },
      },
      message: '登录成功',
    } as ApiResponse);
  } catch (error: any) {
    console.error('租户用户登录失败:', error.message || error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '登录过程中发生服务器错误',
    } as ApiResponse);
  }
});

/**
 * POST /api/auth/change-password
 * 修改密码接口
 *
 * 支持开发者和租户用户修改密码。需要提供旧密码进行验证，
 * 验证通过后将新密码使用 bcryptjs 加密后存储。
 *
 * 请求头：Authorization: Bearer <token>
 * 请求体：
 * - oldPassword: string - 旧密码
 * - newPassword: string - 新密码
 *
 * 安全要求：
 * - 新密码长度不少于 6 位
 * - 旧密码必须正确
 */
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 从请求体获取新旧密码
    const { oldPassword, newPassword } = req.body;

    // 参数校验
    if (!oldPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: '旧密码和新密码不能为空',
      } as ApiResponse);
      return;
    }

    // 新密码强度校验：至少6位
    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: 'WEAK_PASSWORD',
        message: '新密码长度不能少于6位',
      } as ApiResponse);
      return;
    }

    // 根据用户类型分别处理
    if (req.user!.type === 'developer') {
      // ---- 开发者修改密码 ----

      // 查询开发者记录
      const developer = await prisma.developer.findUnique({
        where: { id: req.user!.id },
      });

      if (!developer) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '开发者账户不存在',
        } as ApiResponse);
        return;
      }

      // 验证旧密码
      const isOldPasswordValid = await bcrypt.compare(oldPassword, developer.passwordHash);
      if (!isOldPasswordValid) {
        res.status(400).json({
          success: false,
          error: 'INVALID_OLD_PASSWORD',
          message: '旧密码不正确',
        } as ApiResponse);
        return;
      }

      // 使用 bcryptjs 对新密码进行加密（salt rounds = 10）
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await prisma.developer.update({
        where: { id: developer.id },
        data: { passwordHash: newPasswordHash },
      });

      // 记录操作日志
      await createLog({
        developerId: developer.id,
        action: 'UPDATE',
        module: 'auth',
        description: `开发者 ${developer.name} 修改了密码`,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: '密码修改成功',
      } as ApiResponse);
    } else if (req.user!.type === 'user') {
      // ---- 租户用户修改密码 ----

      // 查询用户记录
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '用户不存在',
        } as ApiResponse);
        return;
      }

      // 验证旧密码
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isOldPasswordValid) {
        res.status(400).json({
          success: false,
          error: 'INVALID_OLD_PASSWORD',
          message: '旧密码不正确',
        } as ApiResponse);
        return;
      }

      // 加密新密码
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      // 记录操作日志
      await createLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'UPDATE',
        module: 'auth',
        description: `用户 ${user.name} 修改了密码`,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: '密码修改成功',
      } as ApiResponse);
    } else {
      // 未知用户类型
      res.status(400).json({
        success: false,
        error: 'INVALID_USER_TYPE',
        message: '不支持的用户类型',
      } as ApiResponse);
    }
  } catch (error: any) {
    console.error('修改密码失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '修改密码过程中发生服务器错误',
    } as ApiResponse);
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息接口
 *
 * 通过已认证的 JWT Token 获取当前登录用户的详细信息。
 * 支持开发者和租户用户两种身份。
 *
 * 请求头：Authorization: Bearer <token>
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.type === 'developer') {
      // ---- 开发者信息 ----

      const developer = await prisma.developer.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      if (!developer) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '开发者账户不存在',
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          ...developer,
          type: 'developer',
          // 如果处于开发者视角模式，附加租户信息
          isDevView: req.user!.isDevView || false,
          tenantId: req.user!.tenantId || null,
        },
      } as ApiResponse);
    } else if (req.user!.type === 'user') {
      // ---- 租户用户信息 ----

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '用户不存在',
        } as ApiResponse);
        return;
      }

      // 提取权限列表
      const permissionFields = user.role?.permissions
        ? Object.entries(user.role.permissions)
            .filter(([, value]: [string, any]) => value === true)
            .map(([key]) => key)
        : [];

      const enabledModules = await getTenantEnabledModules(user.tenantId);

      res.json({
        success: true,
        data: {
          id: user.id,
          type: 'user',
          tenantId: user.tenantId,
          tenant: user.tenant,
          departmentId: user.departmentId,
          department: user.department,
          username: user.username,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role?.name,
          displayName: user.role?.displayName,
          dataScope: user.dataScope,
          permissions: permissionFields,
          enabledModules,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      } as ApiResponse);
    } else {
      res.status(400).json({
        success: false,
        error: 'INVALID_USER_TYPE',
        message: '不支持的用户类型',
      } as ApiResponse);
    }
  } catch (error: any) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取用户信息过程中发生服务器错误',
    } as ApiResponse);
  }
});

/**
 * POST /api/auth/developer/enter-tenant/:tenantId
 * 开发者进入企业视角接口
 *
 * 允许平台开发者以指定租户的身份查看和管理数据。
 * 成功后返回新的 JWT Token（开发者视角 Token，有效期 4 小时）。
 *
 * 路径参数：
 * - tenantId: string - 目标租户ID
 *
 * 请求头：Authorization: Bearer <token>（需为开发者 Token）
 *
 * 安全说明：
 * - 仅开发者可调用此接口
 * - 开发者视角 Token 有效期较短（4小时）
 * - Token 中 isDevView 标记为 true，便于后端识别
 */
router.post('/developer/enter-tenant/:tenantId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 验证调用者必须是开发者
    if (req.user!.type !== 'developer') {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '仅平台开发者可进入企业视角',
      } as ApiResponse);
      return;
    }

    // 从路径参数获取目标租户ID
    const { tenantId } = req.params;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: '请指定要进入的企业ID',
      } as ApiResponse);
      return;
    }

    // 验证目标租户是否存在
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '指定的企业不存在',
      } as ApiResponse);
      return;
    }

    // 签发开发者视角 Token
    // 使用 signDevViewToken 方法，Token 有效期为 4 小时
    const token = signDevViewToken(req.user!.id, tenantId);
    // 同时签发 dev-view 专用长期凭证（用于 Token 过期后自动续期时保留 isDevView / tenantId）
    const refreshToken = await storeRefreshToken({
      userId: req.user!.id,
      userType: 'developer',
      tenantId: tenantId,
    });

    // 记录操作日志
    await createLog({
      developerId: req.user!.id,
      tenantId: tenantId,
      action: 'LOGIN',
      module: 'auth',
      description: `开发者进入企业视角（企业：${tenant.name}）`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: req.user!.id,
          username: `dev_${(req.user as any).username || 'admin'}`,
          name: `开发者（${tenant.name}视角）`,
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantCode: tenant.code,
          role: 'admin',
          isDeveloper: false,
        },
      },
      message: `已进入企业「${tenant.name}」的视角`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('进入企业视角失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '进入企业视角过程中发生服务器错误',
    } as ApiResponse);
  }
});

/**
 * POST /api/auth/developer/exit-tenant
 * 开发者退出企业视角接口
 *
 * 开发者退出租户视角模式，返回正常的开发者 Token。
 *
 * 请求头：Authorization: Bearer <token>（需为开发者 Token）
 */
router.post('/developer/exit-tenant', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 验证调用者必须是开发者
    if (req.user!.type !== 'developer') {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '仅平台开发者可执行此操作',
      } as ApiResponse);
      return;
    }

    // 记录操作日志（如果当前处于开发者视角模式）
    if (req.user!.isDevView && req.user!.tenantId) {
      // 查询租户名称用于日志记录
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.user!.tenantId },
        select: { name: true },
      });

      await createLog({
        developerId: req.user!.id,
        tenantId: req.user!.tenantId,
        action: 'LOGOUT',
        module: 'auth',
        description: `开发者退出企业视角（企业：${tenant?.name || '未知'}）`,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    // 签发普通开发者 Token（不含租户信息）
    const token = signToken({
      id: req.user!.id,
      type: 'developer',
    });

    res.json({
      success: true,
      data: { token },
      message: '已退出企业视角，返回开发者模式',
    } as ApiResponse);
  } catch (error: any) {
    console.error('退出企业视角失败:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '退出企业视角过程中发生服务器错误',
    } as ApiResponse);
  }
});

// ============================================
// 用户自注册
// ============================================

/**
 * POST /api/auth/register
 * 用户自注册接口（无需短信验证）
 *
 * 注册流程：
 * 1. 校验请求参数（企业名称、联系人、手机号、密码）
 * 2. 检查企业代码是否已存在
 * 3. 使用事务创建：租户 + 订阅（30天试用）+ 默认角色权限 + 管理员用户
 * 4. 签发 JWT Token，自动登录
 * 5. 记录操作日志
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { companyName, contactName, phone, password, username } = req.body;

    // 参数校验
    if (!companyName || !contactName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: '请填写完整信息：企业名称、联系人、手机号、密码',
      } as ApiResponse);
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度不能少于6位',
      } as ApiResponse);
    }

    // 生成企业代码（企业名称拼音首字母 + 4位随机数字）
    const codePrefix = companyName.substring(0, 4).toUpperCase();
    const codeRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
    let tenantCode = `${codePrefix}${codeRandom}`;

    // 确保企业代码唯一
    let codeExists = await prisma.tenant.findUnique({ where: { code: tenantCode } });
    while (codeExists) {
      tenantCode = `${codePrefix}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      codeExists = await prisma.tenant.findUnique({ where: { code: tenantCode } });
    }

    // 用户名默认使用手机号
    const adminUsername = username || phone;

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    // 使用事务创建租户 + 订阅 + 角色 + 管理员
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建租户
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          code: tenantCode,
          contactName,
          contactPhone: phone,
          isActive: true,
        },
      });

      // 2. 创建订阅（30天全功能试用）
      const trialEndAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'FULL',
          tier: 'SMALL',
          maxUsers: 5,
          pricePerMonth: 888,
          pricePerExtraUser: 100,
          currentUsers: 1,
          status: 'TRIAL',
          trialEndAt,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndAt,
        },
      });

      // 新注册企业默认开通三大业务模块，保持与开发者后台创建企业一致。
      await tx.tenantModuleEntitlement.createMany({
        data: TENANT_MODULE_KEYS.map(moduleKey => ({
          tenantId: tenant.id,
          moduleKey,
          isEnabled: true,
          enabledAt: new Date(),
          remark: '新企业默认试用开通',
        })),
      });

      // 3. 创建管理员角色（含全部权限）
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'admin',
          displayName: '管理员',
          description: '企业管理员，拥有所有功能权限',
          isDefault: true,
          permissions: {
            create: {
              canViewDashboard: true,
              canManageSystem: true,
              canViewLogs: true,
              canExport: true,
              canViewInventory: true,
              canInbound: true,
              canOutbound: true,
              canReturn: true,
              canTransfer: true,
              canViewRecords: true,
              canViewWorkTeamLedger: true,
              canManagePersonnel: true,
              canManageAttendance: true,
              canManageSalary: true,
              canManagePayment: true,
              canManageAnomaly: true,
              canManageReport: true,
              canManageContract: true,
              canManageDepartment: true,
            },
          },
        },
      });

      // 4. 创建管理员用户
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          username: adminUsername,
          passwordHash,
          name: contactName,
          phone,
          roleId: adminRole.id,
          dataScope: 'ALL',
          isActive: true,
        },
      });

      return { tenant, user };
    });

    // 签发 JWT Token
    const token = signToken({
      id: result.user.id,
      type: 'user',
      tenantId: result.tenant.id,
      role: 'admin',
      dataScope: 'ALL',
    });
    const enabledModules = await getTenantEnabledModules(result.tenant.id);

    // 记录操作日志
    await createLog({
      tenantId: result.tenant.id,
      userId: result.user.id,
      action: 'CREATE' as string,
      module: 'auth',
      description: `新企业注册：${companyName}`,
      detail: { companyName, contactName, phone },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // 返回注册结果（自动登录）
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          phone: result.user.phone,
          role: 'admin',
          dataScope: 'ALL',
          enabledModules,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          code: result.tenant.code,
        },
      },
      message: '注册成功，欢迎使用资料通工程管理系统！',
    } as ApiResponse);
  } catch (error: any) {
    console.error('用户注册失败:', error);

    // 处理唯一约束冲突
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[];
      if (target?.includes('username')) {
        return res.status(409).json({
          success: false,
          message: '用户名已存在，请更换',
        } as ApiResponse);
      }
    }

    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试',
    } as ApiResponse);
  }
});

// ============================================
// 长期登录续期：用 RefreshToken 换新 JWT
// ============================================

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'MISSING_REFRESH_TOKEN', message: '缺少长期凭证' } as ApiResponse);
      return;
    }

    const record = await verifyAndConsumeRefreshToken(refreshToken);
    if (!record) {
      res.status(401).json({ success: false, error: 'INVALID_REFRESH_TOKEN', message: '长期凭证无效或已过期，请重新登录' } as ApiResponse);
      return;
    }

    // 签发新的短期 JWT
    const tokenPayload: any = { id: record.userId, type: record.userType };
    if (record.tenantId) tokenPayload.tenantId = record.tenantId;
    // 保留开发者视角标记（dev-view refresh token 的特征：developer 类型 + 有 tenantId）
    if (record.userType === 'developer' && record.tenantId) {
      tokenPayload.isDevView = true;
    }

    const newToken = signToken(tokenPayload);
    // 同时签发新的长期凭证
    const newRefreshToken = await storeRefreshToken({
      userId: record.userId,
      userType: record.userType as 'developer' | 'user',
      tenantId: record.tenantId || undefined,
    });

    res.json({
      success: true,
      data: { token: newToken, refreshToken: newRefreshToken },
      message: '登录已续期',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Token 续期失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 导出路由器
// ============================================
export default router;
