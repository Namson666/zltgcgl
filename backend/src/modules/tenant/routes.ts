// ============================================
// 租户管理路由模块（HTTP层）
// ============================================
// 只负责：解析请求参数、调用服务层、返回响应
// 业务逻辑全部在 service.ts 中

import { Router, Response } from 'express';
import { authenticate, requireUser } from '../../common/middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';
import * as tenantService from './service';

const router = Router();

// ============================================
// 企业信息管理
// ============================================

router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }
    const tenant = await tenantService.getTenantProfile(tenantId);
    res.json({ success: true, data: tenant } as ApiResponse);
  } catch (error: any) {
    console.error('获取企业信息失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }
    const { name, contactName, contactPhone, address } = req.body;
    const updatedTenant = await tenantService.updateTenantProfile(tenantId, { name, contactName, contactPhone, address });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'tenant', description: '更新企业信息', detail: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updatedTenant, message: '企业信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新企业信息失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 用户管理
// ============================================

router.get('/users', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { users, total, totalPages } = await tenantService.listUsers({
      tenantId, page, pageSize,
      search: req.query.search as string | undefined,
      roleId: req.query.roleId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      isActive: req.query.isActive as string | undefined,
    });
    res.json({ success: true, data: users, pagination: { page, pageSize, total, totalPages } } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/users', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { username, password, name, phone, email, roleId, departmentId, dataScope } = req.body;
    if (!username || !password || !name || !roleId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '用户名、密码、姓名和角色ID不能为空' } as ApiResponse);
      return;
    }
    const user = await tenantService.createUser({ tenantId, username, password, name, phone, email, roleId, departmentId, dataScope });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: 'user', description: `创建用户「${name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: user, message: '用户创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建用户失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/users/:userId', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, phone, email, roleId, departmentId, dataScope } = req.body;
    const { oldName, updated } = await tenantService.updateUser(tenantId, req.params.userId, { name, phone, email, roleId, departmentId, dataScope });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'user', description: `更新用户信息「${oldName}」`, detail: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '用户信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新用户信息失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.patch('/users/:userId/toggle', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { updated, wasActive, userName } = await tenantService.toggleUser(tenantId, req.params.userId);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'user', description: `${wasActive ? '停用' : '启用'}用户「${userName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { id: updated.id, isActive: updated.isActive }, message: `用户已${updated.isActive ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换用户状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/users/:userId/reset-password', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { newPassword } = req.body;
    if (!newPassword) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '新密码不能为空' } as ApiResponse);
      return;
    }
    const { userName } = await tenantService.resetUserPassword(tenantId, req.params.userId, newPassword);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'user', description: `重置用户「${userName}」的密码`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '密码重置成功' } as ApiResponse);
  } catch (error: any) {
    console.error('重置用户密码失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 角色权限管理
// ============================================

router.get('/roles', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const roles = await tenantService.listRoles(req.user!.tenantId!);
    res.json({ success: true, data: roles } as ApiResponse);
  } catch (error: any) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/roles/:roleId/permissions', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { role, permission, permissionData } = await tenantService.updateRolePermissions(tenantId, req.params.roleId, req.body);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'role', description: `更新角色「${role.displayName}」的权限配置`, detail: permissionData, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: permission, message: '角色权限更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新角色权限失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/roles', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, displayName, description } = req.body;
    if (!name || !displayName) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '角色标识和显示名称不能为空' } as ApiResponse);
      return;
    }
    if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
      res.status(400).json({ success: false, error: 'INVALID_NAME', message: '角色标识只能使用字母、数字和下划线，且不能以数字开头' } as ApiResponse);
      return;
    }
    const role = await tenantService.createRole(tenantId, { name, displayName, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: 'role', description: `创建角色「${displayName}」（标识：${name}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: role, message: '角色创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建角色失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/roles/:roleId', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, displayName, description } = req.body;
    if (!name && !displayName && description === undefined) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '至少需要修改一个字段' } as ApiResponse);
      return;
    }
    if (name && !/^[a-z_][a-z0-9_]*$/i.test(name)) {
      res.status(400).json({ success: false, error: 'INVALID_NAME', message: '角色标识只能使用字母、数字和下划线，且不能以数字开头' } as ApiResponse);
      return;
    }
    const role = await tenantService.updateRole(tenantId, req.params.roleId, { name, displayName, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'role', description: `修改角色「${role.displayName}」信息`, detail: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: role, message: '角色信息已更新' } as ApiResponse);
  } catch (error: any) {
    console.error('更新角色失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.delete('/roles/:roleId', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    await tenantService.deleteRole(tenantId, req.params.roleId);
    await createLog({ tenantId, userId: req.user!.id, action: 'DELETE', module: 'role', description: `删除角色`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '角色已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除角色失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 项目部管理（legacy - /api/tenants/departments）
// ============================================

router.get('/departments', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { departments, total, totalPages } = await tenantService.listTenantDepartments({
      tenantId, page, pageSize,
      search: req.query.search as string | undefined,
      isActive: req.query.isActive as string | undefined,
    });
    res.json({ success: true, data: departments, pagination: { page, pageSize, total, totalPages } } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取项目部列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/departments', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, code, contractId, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '项目部名称和编号不能为空' } as ApiResponse);
      return;
    }
    const department = await tenantService.createTenantDepartment({ tenantId, name, code, contractId, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: 'department', description: `创建项目部「${name}」（编号：${code}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: department, message: '项目部创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建项目部失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/departments/:id', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, code, contractId, description } = req.body;
    const { oldName, updated } = await tenantService.updateTenantDepartment(tenantId, req.params.id, { name, code, contractId, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'department', description: `更新项目部信息「${oldName}」`, detail: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '项目部信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新项目部失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.patch('/departments/:id/toggle', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { updated, wasActive, deptName } = await tenantService.toggleTenantDepartment(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'department', description: `${wasActive ? '停用' : '启用'}项目部「${deptName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { id: updated.id, isActive: updated.isActive }, message: `项目部已${updated.isActive ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换项目部状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

export default router;
