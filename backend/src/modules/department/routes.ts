// ============================================
// 项目部管理路由模块（HTTP层）
// ============================================
// 只负责：解析请求参数、调用服务层、返回响应
// 业务逻辑全部在 service.ts 中

import { Router, Response } from 'express';
import { authenticate } from '../../common/middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';
import * as deptService from './service';

const router = Router();

// ============================================
// 项目部 CRUD
// ============================================

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }
    const { departments, total, totalPages } = await deptService.listDepartments({
      tenantId,
      page: Math.max(1, parseInt(req.query.page as string) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20)),
      search: req.query.search as string | undefined,
      isActive: req.query.isActive as string | undefined,
      contractId: req.query.contractId as string | undefined,
    });
    res.json({
      success: true,
      data: departments,
      pagination: { page: Math.max(1, parseInt(req.query.page as string) || 1), pageSize: Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20)), total, totalPages },
    } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取项目部列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, code, contractId, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '项目部名称和编号不能为空' } as ApiResponse);
      return;
    }
    const department = await deptService.createDepartment({ tenantId, name, code, contractId, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: 'department', description: `创建项目部「${name}」（编号：${code}）`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: department, message: '项目部创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建项目部失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const department = await deptService.getDepartmentById(tenantId, req.params.id);
    if (!department) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '指定的项目部不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: department } as ApiResponse);
  } catch (error: any) {
    console.error('获取项目部详情失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, code, contractId, description } = req.body;
    const { oldName, updated } = await deptService.updateDepartment(tenantId, req.params.id, { name, code, contractId, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'department', description: `更新项目部信息「${oldName}」`, detail: { name, code, contractId, description }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '项目部信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新项目部失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.patch('/:id/toggle', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { updated, wasActive, deptName } = await deptService.toggleDepartment(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'department', description: `${wasActive ? '停用' : '启用'}项目部「${deptName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { id: updated.id, isActive: updated.isActive }, message: `项目部已${updated.isActive ? '启用' : '停用'}` } as ApiResponse);
  } catch (error: any) {
    console.error('切换项目部状态失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 子项目管理
// ============================================

router.get('/:id/sub-projects', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const subProjects = await deptService.getSubProjects(tenantId, req.params.id);
    res.json({ success: true, data: subProjects } as ApiResponse);
  } catch (error: any) {
    console.error('获取子项目列表失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.post('/:id/sub-projects', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, code, description } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '项目名称不能为空' } as ApiResponse);
      return;
    }
    const subProject = await deptService.createSubProject(tenantId, req.params.id, { name, code, description });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: 'department', description: `在项目部下创建子项目「${name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: subProject, message: '子项目创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建子项目失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.put('/:id/sub-projects/:subId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, code, description, isActive } = req.body;
    const { oldName, updated } = await deptService.updateSubProject(tenantId, req.params.id, req.params.subId, { name, code, description, isActive });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'department', description: `更新子项目「${oldName}」`, detail: { name, code, description, isActive }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '子项目更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新子项目失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 成员管理
// ============================================

router.post('/:id/members', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请提供要添加的用户ID列表' } as ApiResponse);
      return;
    }
    const { departmentName, updatedCount } = await deptService.addMembers(tenantId, req.params.id, userIds);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'department', description: `向项目部「${departmentName}」添加 ${updatedCount} 名成员`, detail: { userIds }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { updatedCount }, message: `成功添加 ${updatedCount} 名成员到项目部` } as ApiResponse);
  } catch (error: any) {
    console.error('添加项目部成员失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.delete('/:id/members/:userId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { userName } = await deptService.removeMember(tenantId, req.params.id, req.params.userId);
    await createLog({ tenantId, userId: req.user!.id, action: 'DELETE', module: 'department', description: `从项目部移除成员「${userName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: '成员已从项目部移除' } as ApiResponse);
  } catch (error: any) {
    console.error('移除项目部成员失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

export default router;
