// ============================================
// 订阅计费路由模块（HTTP层）
// ============================================
// 只负责：解析请求参数、调用服务层、返回响应
// 业务逻辑全部在 service.ts 中

import { Router, Response } from 'express';
import { authenticate } from '../../common/middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';
import * as subService from './service';

const router = Router();

// ============================================
// 当前订阅
// ============================================

router.get('/current', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }
    const data = await subService.getCurrentSubscription(tenantId);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取当前订阅信息失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 订阅计划
// ============================================

router.get('/plans', authenticate, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plans = subService.listPlans();
    res.json({ success: true, data: plans } as ApiResponse);
  } catch (error: any) {
    console.error('获取订阅计划列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 更改订阅计划
// ============================================

router.post('/change-plan', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }
    const { plan, tier } = req.body;
    if (!plan || !tier) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '订阅计划和层级不能为空' } as ApiResponse);
      return;
    }
    const { subscription, oldPlan, oldTier } = await subService.changeSubscriptionPlan(tenantId, plan, tier);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: 'subscription', description: `更改订阅计划为「${subService.PLAN_CONFIG[plan].name} - ${tier}」`, detail: { oldPlan, oldTier, newPlan: plan, newTier: tier }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: subscription, message: '订阅计划更改成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更改订阅计划失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 支付记录
// ============================================

router.get('/payments', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const { payments, total, totalPages } = await subService.listPayments({ tenantId, page, pageSize, status: req.query.status as string | undefined });
    res.json({ success: true, data: payments, pagination: { page, pageSize, total, totalPages } } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取支付记录失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

export default router;
