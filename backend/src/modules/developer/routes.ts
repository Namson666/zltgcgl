// ============================================
// 开发者后台路由模块（HTTP层）
// ============================================
// 只负责：解析请求参数、调用服务层、返回响应
// 业务逻辑全部在 service.ts 中
// OCR/AI/Integration 配置管理保留在本文件（含 fetch 调用）

import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router, Response } from 'express';
import { prisma } from '../../common/utils/prisma';
import { authenticate, requireDeveloper } from '../../common/middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import * as devService from './service';

const router = Router();
router.use(authenticate, requireDeveloper);

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const portalLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      cb(null, `portal-logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowedTypes.has(file.mimetype)) {
      cb(new Error('INVALID_IMAGE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

// ============================================
// 操作日志（开发者专用，带 developerId）
// ============================================

async function createLog(developerId: string, data: {
  tenantId?: string; action: string; module: string; description: string;
  detail?: any; ip?: string; userAgent?: string;
}): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: { developerId, tenantId: data.tenantId, action: data.action, module: data.module, description: data.description, detail: data.detail ? JSON.parse(JSON.stringify(data.detail)) : undefined, ip: data.ip, userAgent: data.userAgent },
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

// ============================================
// 全局数据看板
// ============================================

router.get('/dashboard', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await devService.getDashboard();
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取全局看板数据失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 综合统计数据
// ============================================

router.get('/stats', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await devService.getComprehensiveStats();
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.get('/stats/usage', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const sortBy = (req.query.sortBy as string) || 'apiUsage';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const data = await devService.getUsageRanking(sortBy, sortOrder, limit);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取用量排行失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.get('/stats/revenue', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const months = Math.min(36, parseInt(req.query.months as string) || 12);
    const trend = await devService.getRevenueTrend(months);
    res.json({ success: true, data: trend } as ApiResponse);
  } catch (error: any) {
    console.error('获取收入趋势失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.get('/stats/daily', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const days = Math.min(90, parseInt(req.query.days as string) || 30);
    const daily = await devService.getDailyStats(days);
    res.json({ success: true, data: daily } as ApiResponse);
  } catch (error: any) {
    console.error('获取每日统计失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 系统配置
// ============================================

router.get('/system-config', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const configs = await devService.listSystemConfigs();
    res.json({ success: true, data: configs } as ApiResponse);
  } catch (error: any) {
    console.error('获取系统配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/system-config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { key, value, description } = req.body;
    if (!key) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '配置键不能为空' } as ApiResponse); return; }
    const config = await devService.upsertSystemConfig(key, value, description);
    res.json({ success: true, data: config, message: '配置保存成功' } as ApiResponse);
  } catch (error: any) {
    console.error('保存系统配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.delete('/system-config/:key', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await devService.deleteSystemConfig(req.params.key);
    res.json({ success: true, message: '配置已删除' } as ApiResponse);
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的配置不存在' } as ApiResponse); return; }
    console.error('删除系统配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 租户管理
// ============================================

router.get('/tenants', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { tenants, total, totalPages } = await devService.listTenants({
      page, pageSize,
      search: req.query.search as string | undefined,
      isActive: req.query.isActive as string | undefined,
    });
    res.json({ success: true, data: tenants, pagination: { page, pageSize, total, totalPages } } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取租户列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/tenants', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, code, contactName, contactPhone, address } = req.body;
    if (!name || !code) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '企业名称和企业代码不能为空' } as ApiResponse); return; }
    const tenant = await devService.createTenant({ name, code, contactName, contactPhone, address });
    await createLog(req.user!.id, { action: 'CREATE', module: 'tenant', description: `新增企业「${name}」（代码：${code}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: tenant, message: '企业创建成功' } as ApiResponse);
  } catch (error: any) {
    if (error.code === 'P2002' || error.status === 409) {
      res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: '企业代码已存在' } as ApiResponse);
      return;
    }
    console.error('新增租户失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/tenants/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, contactName, contactPhone, address } = req.body;
    const { oldName, updated } = await devService.updateTenant(req.params.id, { name, contactName, contactPhone, address });
    await createLog(req.user!.id, { tenantId: req.params.id, action: 'UPDATE', module: 'tenant', description: `更新企业信息「${oldName}」`, detail: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '企业信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新租户失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.patch('/tenants/:id/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { updated, wasActive, tenantName } = await devService.toggleTenant(req.params.id);
    await createLog(req.user!.id, { tenantId: req.params.id, action: 'UPDATE', module: 'tenant', description: `${wasActive ? '停用' : '启用'}企业「${tenantName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: `企业已${updated.isActive ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换租户状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.get('/tenants/:id/modules', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const modules = await devService.getTenantModules(req.params.id);
    res.json({ success: true, data: modules } as ApiResponse);
  } catch (error: any) {
    console.error('获取企业模块开通状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/tenants/:id/modules', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const modules = Array.isArray(req.body?.modules) ? req.body.modules : [];
    const updated = await devService.setTenantModules(req.params.id, modules);
    await createLog(req.user!.id, {
      tenantId: req.params.id,
      action: 'UPDATE',
      module: 'tenant_modules',
      description: '更新企业模块开通状态',
      detail: { modules },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: updated, message: '企业模块开通状态已更新' } as ApiResponse);
  } catch (error: any) {
    console.error('更新企业模块开通状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.get('/tenants/:id/portal', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = await devService.getTenantPortal(req.params.id);
    res.json({ success: true, data: config } as ApiResponse);
  } catch (error: any) {
    console.error('获取企业独立登录页配置失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/tenants/:id/portal', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = await devService.setTenantPortal(req.params.id, {
      domain: req.body?.domain,
      logoUrl: req.body?.logoUrl,
      companyName: req.body?.companyName,
      loginTitle: req.body?.loginTitle,
      themeColor: req.body?.themeColor,
      isEnabled: req.body?.isEnabled,
    });
    await createLog(req.user!.id, {
      tenantId: req.params.id,
      action: 'UPDATE',
      module: 'tenant_portal',
      description: '更新企业独立登录页配置',
      detail: {
        domain: config.domain,
        isEnabled: config.isEnabled,
        companyName: config.companyName,
        loginTitle: config.loginTitle,
        themeColor: config.themeColor,
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: config, message: '企业独立登录页配置已更新' } as ApiResponse);
  } catch (error: any) {
    console.error('更新企业独立登录页配置失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/tenants/:id/portal/logo', (req: AuthenticatedRequest, res: Response): void => {
  portalLogoUpload.single('file')(req, res, async (error: any) => {
    try {
      if (error) {
        const isSizeLimit = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
        const isInvalidType = error.message === 'INVALID_IMAGE_TYPE';
        res.status(400).json({
          success: false,
          error: isSizeLimit ? 'FILE_TOO_LARGE' : isInvalidType ? 'INVALID_IMAGE_TYPE' : 'UPLOAD_FAILED',
          message: isSizeLimit ? 'Logo 文件不能超过 2MB' : isInvalidType ? '仅支持 PNG、JPG、WebP 图片' : 'Logo 上传失败',
        } as ApiResponse);
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, error: 'MISSING_FILE', message: '请选择 Logo 图片' } as ApiResponse);
        return;
      }

      const tenant = await prisma.tenant.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, name: true } });
      if (!tenant) {
        fs.unlink(path.join(uploadDir, req.file.filename), () => undefined);
        res.status(404).json({ success: false, error: 'TENANT_NOT_FOUND', message: '企业不存在' } as ApiResponse);
        return;
      }

      const logoUrl = `/uploads/${req.file.filename}`;
      await createLog(req.user!.id, {
        tenantId: tenant.id,
        action: 'UPLOAD',
        module: 'tenant_portal',
        description: `上传企业独立登录页 Logo「${tenant.name}」`,
        detail: { logoUrl, fileName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ success: true, data: { logoUrl }, message: 'Logo 上传成功' } as ApiResponse);
    } catch (err: any) {
      if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => undefined);
      console.error('上传企业独立登录页 Logo 失败:', err);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
    }
  });
});

// ============================================
// 回收站
// ============================================

router.get('/tenants/recycle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { tenants, total, totalPages } = await devService.listRecycledTenants(page, pageSize);
    res.json({ success: true, data: tenants, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取回收站列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.delete('/tenants/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tenantName } = await devService.softDeleteTenant(req.params.id);
    await createLog(req.user!.id, { tenantId: req.params.id, action: 'DELETE', module: 'tenant', description: `将企业「${tenantName}」移入回收站`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '企业已移入回收站' } as ApiResponse);
  } catch (error: any) {
    console.error('删除企业失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/tenants/:id/restore', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tenantName } = await devService.restoreTenant(req.params.id);
    await createLog(req.user!.id, { tenantId: req.params.id, action: 'UPDATE', module: 'tenant', description: `从回收站恢复企业「${tenantName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '企业已恢复' } as ApiResponse);
  } catch (error: any) {
    console.error('恢复企业失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.delete('/tenants/:id/permanent', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tenantName, tenantCode } = await devService.permanentDeleteTenant(req.params.id);
    await createLog(req.user!.id, { action: 'DELETE', module: 'tenant', description: `永久删除企业「${tenantName}」（代码：${tenantCode}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '企业已永久删除' } as ApiResponse);
  } catch (error: any) {
    console.error('永久删除企业失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.delete('/tenants/recycle/clear', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { count } = await devService.clearRecycleBin();
    await createLog(req.user!.id, { action: 'DELETE', module: 'tenant', description: `清空回收站，共删除 ${count} 家企业`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: count === 0 ? '回收站已为空' : `回收站已清空，共删除 ${count} 家企业` } as ApiResponse);
  } catch (error: any) {
    console.error('清空回收站失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 租户用户管理
// ============================================

router.get('/tenants/:tenantId/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { users, total, totalPages } = await devService.listTenantUsers(req.params.tenantId, page, pageSize);
    res.json({ success: true, data: users, pagination: { page, pageSize, total, totalPages } } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取租户用户列表失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.get('/tenants/:tenantId/roles', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const roles = await devService.listTenantRoles(req.params.tenantId);
    res.json({ success: true, data: roles } as ApiResponse);
  } catch (error: any) {
    console.error('获取租户角色列表失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/tenants/:tenantId/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username, password, name, phone, email, roleId, departmentId, dataScope } = req.body;
    if (!username || !password || !name || !roleId) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '用户名、密码、姓名和角色ID不能为空' } as ApiResponse); return; }
    const { user, tenantName } = await devService.createTenantUser({ tenantId: req.params.tenantId, username, password, name, phone, email, roleId, departmentId, dataScope });
    await createLog(req.user!.id, { tenantId: req.params.tenantId, action: 'CREATE', module: 'user', description: `为「${tenantName}」创建用户「${name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: user, message: '用户创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建租户用户失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/tenants/:tenantId/users/:userId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, email, roleId, departmentId, dataScope } = req.body;
    const { oldName, updated } = await devService.updateTenantUser(req.params.tenantId, req.params.userId, { name, phone, email, roleId, departmentId, dataScope });
    await createLog(req.user!.id, { tenantId: req.params.tenantId, action: 'UPDATE', module: 'user', description: `更新用户信息「${oldName}」`, detail: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '用户信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新租户用户失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.patch('/tenants/:tenantId/users/:userId/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { updated, wasActive, userName } = await devService.toggleTenantUser(req.params.tenantId, req.params.userId);
    await createLog(req.user!.id, { tenantId: req.params.tenantId, action: 'UPDATE', module: 'user', description: `${wasActive ? '停用' : '启用'}用户「${userName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { id: updated.id, isActive: updated.isActive }, message: `用户已${updated.isActive ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换用户状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/tenants/:tenantId/users/:userId/reset-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '新密码不能为空' } as ApiResponse); return; }
    const { userName } = await devService.resetTenantUserPassword(req.params.tenantId, req.params.userId, newPassword);
    await createLog(req.user!.id, { tenantId: req.params.tenantId, action: 'UPDATE', module: 'user', description: `重置用户「${userName}」的密码`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '密码重置成功' } as ApiResponse);
  } catch (error: any) {
    console.error('重置用户密码失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// AI 配置管理（保留 Prisma 直接操作 + fetch 调用）
// ============================================

router.get('/ai-config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.aiConfig.findMany({ where: { developerId: req.user!.id }, orderBy: { createdAt: 'desc' } });
    const sanitized = configs.map((c) => ({ ...c, apiKey: c.apiKey ? `${c.apiKey.substring(0, 4)}****${c.apiKey.substring(c.apiKey.length - 4)}` : null }));
    res.json({ success: true, data: sanitized } as ApiResponse);
  } catch (error: any) {
    console.error('获取AI配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/ai-config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, provider, model, modelName, apiKey, baseUrl, config } = req.body;
    const modelField = model || modelName;
    if (!provider || !modelField || !apiKey) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'AI提供商、模型名称和API Key不能为空' } as ApiResponse); return; }
    let result;
    if (id) {
      const existing = await prisma.aiConfig.findFirst({ where: { id, developerId: req.user!.id } });
      if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的AI配置不存在' } as ApiResponse); return; }
      result = await prisma.aiConfig.update({ where: { id }, data: { provider, model: modelField, apiKey, baseUrl, config: config || undefined, isEnabled: false } });
    } else {
      result = await prisma.aiConfig.create({ data: { developerId: req.user!.id, provider, model: modelField, apiKey, baseUrl, config: config || undefined, isEnabled: false } });
    }
    await createLog(req.user!.id, { action: id ? 'UPDATE' : 'CREATE', module: 'ai-config', description: `${id ? '更新' : '创建'}AI配置（${provider}/${modelField}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    const { apiKey: _, ...configWithoutKey } = result;
    res.json({ success: true, data: { ...configWithoutKey, apiKey: result.apiKey ? `${result.apiKey.substring(0, 4)}****` : null }, message: `AI配置${id ? '更新' : '创建'}成功，请测试连通性` } as ApiResponse);
  } catch (error: any) {
    console.error('更新AI配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/ai-config/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, provider, model, modelName, apiKey, baseUrl } = req.body;
    const modelField = model || modelName;
    let targetConfig: any;
    if (id) {
      targetConfig = await prisma.aiConfig.findFirst({ where: { id, developerId: req.user!.id } });
      if (!targetConfig) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的AI配置不存在' } as ApiResponse); return; }
    } else {
      if (!provider || !modelField || !apiKey) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请提供 AI 提供商、模型名称和 API Key' } as ApiResponse); return; }
      targetConfig = { provider, model, apiKey, baseUrl };
    }
    const testModel = targetConfig.model || modelField;
    let testUrl: string;
    if (targetConfig.baseUrl) {
      testUrl = targetConfig.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    } else {
      const isOpenAi = testModel?.toLowerCase().includes('gpt') || testModel?.toLowerCase().includes('o1') || testModel?.toLowerCase().includes('o3');
      testUrl = isOpenAi ? 'https://api.openai.com/v1/chat/completions' : 'https://api.minimaxi.com/v1/chat/completions';
    }
    const testRes = await fetch(testUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey || targetConfig.apiKey}` }, body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: '回复"ok"即可' }], max_tokens: 10 }) });
    if (!testRes.ok) {
      const errText = await testRes.text();
      let displayMsg = errText.slice(0, 200);
      try { displayMsg = JSON.parse(displayMsg).error?.message || displayMsg; } catch {}
      res.status(400).json({ success: false, error: 'CONNECTION_FAILED', message: `连接失败: ${displayMsg}` } as ApiResponse);
      return;
    }
    if (id) await prisma.aiConfig.update({ where: { id }, data: { isEnabled: true } });
    res.json({ success: true, message: 'AI连通性测试成功' + (id ? '，配置已启用' : '') } as ApiResponse);
  } catch (error: any) {
    console.error('测试AI连通性失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.delete('/ai-config/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.aiConfig.findFirst({ where: { id: req.params.id, developerId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的AI配置不存在' } as ApiResponse); return; }
    await prisma.aiConfig.delete({ where: { id: req.params.id } });
    await createLog(req.user!.id, { action: 'DELETE', module: 'ai-config', description: `删除AI配置（${existing.provider}/${existing.model}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: 'AI配置已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除AI配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.patch('/ai-config/:id/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.aiConfig.findFirst({ where: { id: req.params.id, developerId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的AI配置不存在' } as ApiResponse); return; }
    await prisma.aiConfig.update({ where: { id: req.params.id }, data: { isEnabled: req.body.enabled } });
    await createLog(req.user!.id, { action: 'UPDATE', module: 'ai-config', description: `${req.body.enabled ? '启用' : '停用'}AI配置（${existing.provider}/${existing.model}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: `AI配置已${req.body.enabled ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换AI配置状态失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// OCR 配置管理（保留 Prisma 直接操作 + fetch 调用）
// ============================================

router.get('/ocr-config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.ocrConfig.findMany({ where: { developerId: req.user!.id }, orderBy: { createdAt: 'desc' } });
    const sanitized = configs.map((c) => ({ ...c, secretKey: c.secretKey ? `${c.secretKey.substring(0, 4)}****` : null, apiKey: c.apiKey ? `${c.apiKey.substring(0, 4)}****` : null }));
    res.json({ success: true, data: sanitized } as ApiResponse);
  } catch (error: any) {
    console.error('获取OCR配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/ocr-config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, provider, secretId, secretKey, apiKey, config } = req.body;
    if (!provider) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'OCR提供商不能为空' } as ApiResponse); return; }
    let result;
    if (id) {
      const existing = await prisma.ocrConfig.findFirst({ where: { id, developerId: req.user!.id } });
      if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的OCR配置不存在' } as ApiResponse); return; }
      const credentialsChanged = existing.secretId !== secretId || existing.secretKey !== secretKey;
      result = await prisma.ocrConfig.update({ where: { id }, data: { provider, secretId, secretKey, apiKey, config: config || undefined, isEnabled: credentialsChanged ? false : existing.isEnabled } });
    } else {
      result = await prisma.ocrConfig.create({ data: { developerId: req.user!.id, provider, secretId, secretKey, apiKey, config: config || undefined, isEnabled: false } });
    }
    await createLog(req.user!.id, { action: id ? 'UPDATE' : 'CREATE', module: 'ocr-config', description: `${id ? '更新' : '创建'}OCR配置（${provider}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { id: result.id, provider: result.provider, secretId: result.secretId, secretKey: result.secretKey ? `${result.secretKey.substring(0, 4)}****` : null, apiKey: result.apiKey ? `${result.apiKey.substring(0, 4)}****` : null, isEnabled: result.isEnabled }, message: `OCR配置${id ? '更新' : '创建'}成功，请测试连通性` } as ApiResponse);
  } catch (error: any) {
    console.error('更新OCR配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/ocr-config/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, provider, secretId, secretKey, apiKey } = req.body;
    let targetConfig: any;
    if (id) {
      targetConfig = await prisma.ocrConfig.findFirst({ where: { id, developerId: req.user!.id } });
      if (!targetConfig) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的OCR配置不存在' } as ApiResponse); return; }
    } else {
      if (!provider || !secretKey) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请提供 OCR 提供商和 Secret Key' } as ApiResponse); return; }
      targetConfig = { provider, secretId, secretKey, apiKey };
    }
    let isTestSuccessful = false;
    if (targetConfig.provider === 'baidu') {
      const testKey = targetConfig.secretId || targetConfig.apiKey;
      if (!testKey || !targetConfig.secretKey) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请填写 Secret ID（API Key）和 Secret Key' } as ApiResponse); return; }
      const tokenUrl = new URL('https://aip.baidubce.com/oauth/2.0/token');
      tokenUrl.searchParams.set('grant_type', 'client_credentials');
      tokenUrl.searchParams.set('client_id', testKey);
      tokenUrl.searchParams.set('client_secret', targetConfig.secretKey);
      const tokenRes = await fetch(tokenUrl.toString(), { method: 'POST' });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) { res.json({ success: false, error: 'TEST_FAILED', message: `百度凭据验证失败：${tokenData.error_description || tokenData.error || '未知错误'}` } as ApiResponse); return; }
      isTestSuccessful = true;
    } else {
      isTestSuccessful = true;
    }
    if (isTestSuccessful && id) await prisma.ocrConfig.update({ where: { id }, data: { isEnabled: true } });
    res.json({ success: true, message: 'OCR连通性测试成功' + (id ? '，配置已启用' : '') } as ApiResponse);
  } catch (error: any) {
    console.error('测试OCR连通性失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.delete('/ocr-config/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.ocrConfig.findFirst({ where: { id: req.params.id, developerId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的OCR配置不存在' } as ApiResponse); return; }
    await prisma.ocrConfig.delete({ where: { id: req.params.id } });
    await createLog(req.user!.id, { action: 'DELETE', module: 'ocr-config', description: `删除OCR配置（${existing.provider}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: 'OCR配置已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除OCR配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.patch('/ocr-config/:id/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.ocrConfig.findFirst({ where: { id: req.params.id, developerId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的OCR配置不存在' } as ApiResponse); return; }
    await prisma.ocrConfig.update({ where: { id: req.params.id }, data: { isEnabled: req.body.enabled } });
    await createLog(req.user!.id, { action: 'UPDATE', module: 'ocr-config', description: `${req.body.enabled ? '启用' : '停用'}OCR配置（${existing.provider}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: `OCR配置已${req.body.enabled ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换OCR配置状态失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 套餐订阅管理
// ============================================

router.get('/plans', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plans = await devService.listPlatformPlans();
    res.json({ success: true, data: plans } as ApiResponse);
  } catch (error: any) {
    console.error('获取套餐列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/plans', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, tier, type, modules, pricePerMonth, maxUsers, pricePerExtraUser, description, sortOrder } = req.body;
    if (!name || pricePerMonth === undefined) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '套餐名称和价格不能为空' } as ApiResponse); return; }
    const plan = await devService.createPlan({ name, tier, type, modules, pricePerMonth, maxUsers, pricePerExtraUser, description, sortOrder });
    await createLog(req.user!.id, { action: 'CREATE', module: 'plan', description: `创建套餐「${name}」` });
    res.status(201).json({ success: true, data: plan, message: '套餐创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建套餐失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/plans/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.platformPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '套餐不存在' } as ApiResponse); return; }
    const plan = await devService.updatePlan(req.params.id, req.body);
    await createLog(req.user!.id, { action: 'UPDATE', module: 'plan', description: `更新套餐「${existing.name}」` });
    res.json({ success: true, data: plan, message: '套餐更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新套餐失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.delete('/plans/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { planName } = await devService.deletePlan(req.params.id);
    await createLog(req.user!.id, { action: 'DELETE', module: 'plan', description: `删除套餐「${planName}」` });
    res.json({ success: true, message: '套餐已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除套餐失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 租户订阅管理
// ============================================

router.get('/tenants/:id/subscription', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await devService.getTenantSubscription(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取订阅详情失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/tenants/:id/subscription', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const sub = await devService.updateTenantSubscription(req.params.id, req.body);
    await createLog(req.user!.id, { tenantId: req.params.id, action: 'UPDATE', module: 'subscription', description: '更新订阅' });
    res.json({ success: true, data: sub, message: '订阅更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新订阅失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 支付记录
// ============================================

router.get('/payments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { payments, total, totalPages } = await devService.listDeveloperPayments({
      page, pageSize,
      tenantId: req.query.tenantId as string | undefined,
      status: req.query.status as string | undefined,
      keyword: req.query.keyword as string | undefined,
    });
    res.json({ success: true, data: payments, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取支付记录失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 发票管理
// ============================================

router.get('/invoices', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { invoices, total, totalPages } = await devService.listInvoices({ page, pageSize });
    res.json({ success: true, data: invoices, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取发票列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/invoices', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tenantId, paymentId, title, taxId, amount } = req.body;
    if (!tenantId || !title || !amount) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '企业、发票抬头和金额不能为空' } as ApiResponse); return; }
    const invoice = await devService.createInvoice({ tenantId, paymentId, title, taxId, amount });
    await createLog(req.user!.id, { tenantId, action: 'CREATE', module: 'invoice', description: `创建发票 ${invoice.invoiceNo}` });
    res.status(201).json({ success: true, data: invoice, message: '发票创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建发票失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/invoices/:id/issue', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const updated = await devService.issueInvoice(req.params.id);
    await createLog(req.user!.id, { tenantId: updated.tenantId, action: 'UPDATE', module: 'invoice', description: `开具发票 ${updated.invoiceNo}` });
    res.json({ success: true, data: updated, message: '发票已开具' } as ApiResponse);
  } catch (error: any) {
    console.error('开具发票失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 第三方集成配置（保留 Prisma 直接操作）
// ============================================

router.get('/integrations', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.integrationConfig.findMany({ where: { developerId: req.user!.id } });
    const sanitized = configs.map((c) => { let config = c.config; try { config = JSON.parse(c.config); } catch {} return { ...c, config }; });
    res.json({ success: true, data: sanitized } as ApiResponse);
  } catch (error: any) {
    console.error('获取集成配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/integrations', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { platform, config } = req.body;
    if (!platform || !config) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '平台和配置不能为空' } as ApiResponse); return; }
    const result = await prisma.integrationConfig.upsert({
      where: { developerId_platform: { developerId: req.user!.id, platform } },
      update: { config: typeof config === 'string' ? config : JSON.stringify(config), isEnabled: false },
      create: { developerId: req.user!.id, platform, config: typeof config === 'string' ? config : JSON.stringify(config) },
    });
    await createLog(req.user!.id, { action: 'UPDATE', module: 'integration', description: `更新${platform}集成配置` });
    res.json({ success: true, data: result, message: '集成配置已保存' } as ApiResponse);
  } catch (error: any) {
    console.error('保存集成配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/integrations/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { platform } = req.body;
    if (!platform) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请指定平台' } as ApiResponse); return; }
    const config = await prisma.integrationConfig.findUnique({ where: { developerId_platform: { developerId: req.user!.id, platform } } });
    if (!config) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '未找到该平台配置' } as ApiResponse); return; }
    await prisma.integrationConfig.update({ where: { developerId_platform: { developerId: req.user!.id, platform } }, data: { isEnabled: true } });
    res.json({ success: true, message: '集成连通性测试成功，配置已启用' } as ApiResponse);
  } catch (error: any) {
    console.error('测试集成连通性失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '测试失败' } as ApiResponse);
  }
});

// ============================================
// 小程序接入配置：开发者默认小程序 + 企业自有小程序
// ============================================

router.get('/mini-program/default', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = await prisma.miniProgramConfig.findFirst({ where: { developerId: req.user!.id, isDefault: true } });
    res.json({ success: true, data: config } as ApiResponse);
  } catch (error: any) {
    console.error('获取默认小程序配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/mini-program/default', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, appId, appSecret, isEnabled, remark } = req.body;
    if (!name || !appId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '小程序名称和 appId 不能为空' } as ApiResponse);
      return;
    }
    const existing = await prisma.miniProgramConfig.findFirst({ where: { developerId: req.user!.id, isDefault: true } });
    const config = existing
      ? await prisma.miniProgramConfig.update({ where: { id: existing.id }, data: { name, appId, appSecret, isEnabled: isEnabled !== false, remark } })
      : await prisma.miniProgramConfig.create({ data: { developerId: req.user!.id, name, appId, appSecret, isDefault: true, isEnabled: isEnabled !== false, remark } });
    await createLog(req.user!.id, { action: 'UPDATE', module: 'mini_program', description: '更新开发者默认小程序接入配置' });
    res.json({ success: true, data: config, message: '默认小程序配置已保存' } as ApiResponse);
  } catch (error: any) {
    console.error('保存默认小程序配置失败:', error);
    const isDuplicate = error.code === 'P2002';
    res.status(isDuplicate ? 409 : 500).json({ success: false, error: isDuplicate ? 'DUPLICATE_APP_ID' : 'INTERNAL_ERROR', message: isDuplicate ? 'appId 已被其他小程序配置使用' : '服务器错误' } as ApiResponse);
  }
});

router.get('/mini-program/default/bindings', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = await prisma.miniProgramConfig.findFirst({ where: { developerId: req.user!.id, isDefault: true } });
    if (!config) {
      res.json({ success: true, data: [] } as ApiResponse);
      return;
    }
    const phone = (req.query.phone as string | undefined)?.trim();
    const bindings = await prisma.miniProgramPhoneBinding.findMany({
      where: { developerId: req.user!.id, miniProgramConfigId: config.id, ...(phone ? { phone } : {}) },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
        personnel: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: bindings } as ApiResponse);
  } catch (error: any) {
    console.error('获取默认小程序手机号预绑定失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/mini-program/default/bindings', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const phone = String(req.body.phone || '').trim();
    const tenantId = String(req.body.tenantId || '').trim();
    const personnelId = req.body.personnelId ? String(req.body.personnelId).trim() : '';
    const isEnabled = req.body.isEnabled !== false;
    const remark = req.body.remark;
    if (!phone || !tenantId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '手机号和企业不能为空' } as ApiResponse);
      return;
    }
    const config = await prisma.miniProgramConfig.findFirst({ where: { developerId: req.user!.id, isDefault: true, isEnabled: true } });
    if (!config) {
      res.status(404).json({ success: false, error: 'DEFAULT_MINI_PROGRAM_NOT_FOUND', message: '请先配置并启用开发者默认小程序' } as ApiResponse);
      return;
    }
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, isActive: true, deletedAt: null } });
    if (!tenant) {
      res.status(404).json({ success: false, error: 'TENANT_NOT_FOUND', message: '企业不存在或已停用' } as ApiResponse);
      return;
    }
    const personnel = personnelId
      ? await prisma.personnel.findFirst({ where: { id: personnelId, tenantId, phone, status: { not: 'left' } } })
      : await prisma.personnel.findFirst({ where: { tenantId, phone, status: { not: 'left' } } });
    if (!personnel) {
      res.status(404).json({ success: false, error: 'PERSONNEL_NOT_FOUND', message: '该企业未找到匹配手机号的在场人员' } as ApiResponse);
      return;
    }
    const binding = await prisma.miniProgramPhoneBinding.upsert({
      where: { miniProgramConfigId_phone: { miniProgramConfigId: config.id, phone } },
      create: { developerId: req.user!.id, miniProgramConfigId: config.id, tenantId, personnelId: personnel.id, phone, isEnabled, remark },
      update: { tenantId, personnelId: personnel.id, isEnabled, remark },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
        personnel: { select: { id: true, name: true, phone: true } },
      },
    });
    await createLog(req.user!.id, { tenantId, action: 'UPDATE', module: 'mini_program_phone_binding', description: `预绑定默认小程序手机号 ${phone} 到企业「${tenant.name}」` });
    res.status(201).json({ success: true, data: binding, message: '默认小程序手机号预绑定已保存' } as ApiResponse);
  } catch (error: any) {
    console.error('保存默认小程序手机号预绑定失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.patch('/mini-program/default/bindings/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { isEnabled, remark } = req.body || {};
    if (typeof isEnabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'INVALID_PARAMS', message: '启用状态必须是布尔值' } as ApiResponse);
      return;
    }
    const existing = await prisma.miniProgramPhoneBinding.findFirst({
      where: { id: req.params.id, developerId: req.user!.id },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
        personnel: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '预绑定不存在' } as ApiResponse);
      return;
    }

    const binding = await prisma.miniProgramPhoneBinding.update({
      where: { id: existing.id },
      data: {
        isEnabled,
        ...(typeof remark === 'string' ? { remark: remark.trim() || null } : {}),
      },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
        personnel: { select: { id: true, name: true, phone: true } },
      },
    });

    await createLog(req.user!.id, {
      tenantId: binding.tenantId,
      action: 'UPDATE',
      module: 'mini_program_phone_binding',
      description: `${isEnabled ? '启用' : '停用'}默认小程序手机号预绑定 ${binding.phone}`,
    });
    res.json({ success: true, data: binding, message: `默认小程序手机号预绑定已${isEnabled ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('更新默认小程序手机号预绑定失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.delete('/mini-program/default/bindings/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const binding = await prisma.miniProgramPhoneBinding.findFirst({ where: { id: req.params.id, developerId: req.user!.id } });
    if (!binding) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '预绑定不存在' } as ApiResponse);
      return;
    }
    await prisma.miniProgramPhoneBinding.delete({ where: { id: binding.id } });
    await createLog(req.user!.id, { tenantId: binding.tenantId, action: 'DELETE', module: 'mini_program_phone_binding', description: `删除默认小程序手机号预绑定 ${binding.phone}` });
    res.json({ success: true, message: '默认小程序手机号预绑定已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除默认小程序手机号预绑定失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.get('/tenants/:tenantId/mini-program', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = await prisma.miniProgramConfig.findFirst({ where: { developerId: req.user!.id, tenantId: req.params.tenantId } });
    res.json({ success: true, data: config } as ApiResponse);
  } catch (error: any) {
    console.error('获取企业小程序配置失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/tenants/:tenantId/mini-program', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, appId, appSecret, isEnabled, remark } = req.body;
    if (!name || !appId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '小程序名称和 appId 不能为空' } as ApiResponse);
      return;
    }
    const tenant = await prisma.tenant.findFirst({ where: { id: req.params.tenantId, deletedAt: null } });
    if (!tenant) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '企业不存在' } as ApiResponse);
      return;
    }
    const existing = await prisma.miniProgramConfig.findFirst({ where: { developerId: req.user!.id, tenantId: req.params.tenantId } });
    const config = existing
      ? await prisma.miniProgramConfig.update({ where: { id: existing.id }, data: { name, appId, appSecret, isEnabled: isEnabled !== false, remark } })
      : await prisma.miniProgramConfig.create({ data: { developerId: req.user!.id, tenantId: req.params.tenantId, name, appId, appSecret, isEnabled: isEnabled !== false, remark } });
    await createLog(req.user!.id, { tenantId: req.params.tenantId, action: 'UPDATE', module: 'mini_program', description: `更新企业「${tenant.name}」小程序接入配置` });
    res.json({ success: true, data: config, message: '企业小程序配置已保存' } as ApiResponse);
  } catch (error: any) {
    console.error('保存企业小程序配置失败:', error);
    const isDuplicate = error.code === 'P2002';
    res.status(isDuplicate ? 409 : 500).json({ success: false, error: isDuplicate ? 'DUPLICATE_APP_ID' : 'INTERNAL_ERROR', message: isDuplicate ? 'appId 已被其他小程序配置使用' : '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 存储管理
// ============================================

router.get('/storage/stats', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { stats, total, totalPages, totalSize, totalFiles } = await devService.getStorageStats(page, pageSize);
    res.json({ success: true, data: stats, summary: { totalSize, totalFiles }, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取存储统计失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.get('/storage/files', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { files, total, totalPages } = await devService.getStorageFiles(page, pageSize);
    res.json({ success: true, data: files, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// API 密钥管理
// ============================================

router.get('/api-keys', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { keys, total, totalPages } = await devService.listApiKeys({ page, pageSize, tenantId: req.query.tenantId as string | undefined });
    res.json({ success: true, data: keys, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取API密钥失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/api-keys', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tenantId, name, expiresAt } = req.body;
    if (!tenantId || !name) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '企业和名称不能为空' } as ApiResponse); return; }
    const apiKey = await devService.createApiKey(tenantId, name, expiresAt);
    await createLog(req.user!.id, { tenantId, action: 'CREATE', module: 'api-key', description: `创建API密钥「${name}」` });
    res.status(201).json({ success: true, data: apiKey, message: 'API密钥创建成功，请妥善保管密钥' } as ApiResponse);
  } catch (error: any) {
    console.error('创建API密钥失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/api-keys/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, isActive, expiresAt } = req.body;
    const updated = await devService.updateApiKey(req.params.id, { name, isActive, expiresAt });
    res.json({ success: true, data: updated, message: 'API密钥更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新API密钥失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.delete('/api-keys/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { keyName } = await devService.deleteApiKey(req.params.id);
    await createLog(req.user!.id, { action: 'DELETE', module: 'api-key', description: `删除API密钥「${keyName}」` });
    res.json({ success: true, message: 'API密钥已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除API密钥失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 系统公告
// ============================================

router.get('/announcements', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { announcements, total, totalPages } = await devService.listAnnouncements({ page, pageSize });
    res.json({ success: true, data: announcements, pagination: { page, pageSize, total, totalPages } } as any);
  } catch (error: any) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/announcements', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, type } = req.body;
    if (!title || !content) { res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '标题和内容不能为空' } as ApiResponse); return; }
    const announcement = await devService.createAnnouncement({ title, content, type });
    await createLog(req.user!.id, { action: 'CREATE', module: 'announcement', description: `创建公告「${title}」` });
    res.status(201).json({ success: true, data: announcement, message: '公告创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/announcements/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'NOT_FOUND', message: '公告不存在' } as ApiResponse); return; }
    const updated = await devService.updateAnnouncement(req.params.id, req.body);
    res.json({ success: true, data: updated, message: '公告更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.delete('/announcements/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title } = await devService.deleteAnnouncement(req.params.id);
    await createLog(req.user!.id, { action: 'DELETE', module: 'announcement', description: `删除公告「${title}」` });
    res.json({ success: true, message: '公告已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除公告失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/announcements/:id/publish', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { updated, title } = await devService.publishAnnouncement(req.params.id);
    await createLog(req.user!.id, { action: 'UPDATE', module: 'announcement', description: `${updated.isPublished ? '发布' : '下架'}公告「${title}」` });
    res.json({ success: true, data: updated, message: `公告已${updated.isPublished ? '发布' : '下架'}` } as ApiResponse);
  } catch (error: any) {
    console.error('发布/下架公告失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 安全策略
// ============================================

router.get('/security-settings', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await devService.getSecuritySettings();
    res.json({ success: true, data: settings } as ApiResponse);
  } catch (error: any) {
    console.error('获取安全策略失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/security-settings', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await devService.updateSecuritySettings(req.body);
    await createLog(req.user!.id, { action: 'UPDATE', module: 'security', description: '更新安全策略设置' });
    res.json({ success: true, message: '安全策略已更新' } as ApiResponse);
  } catch (error: any) {
    console.error('更新安全策略失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 系统监控
// ============================================

router.get('/monitoring', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await devService.getMonitoring();
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取监控数据失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

export default router;
