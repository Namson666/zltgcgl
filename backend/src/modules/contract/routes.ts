// ============================================
// 合同管理路由模块（HTTP层）
// ============================================
// 只负责：解析请求参数、调用服务层、返回响应
// 业务逻辑全部在 service.ts 中

import { Router, Response } from 'express';
import { authenticate } from '../../common/middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';
import * as contractService from './service';

const router = Router();

// ============================================
// 合同 CRUD
// ============================================

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'NO_TENANT', message: '当前用户未关联企业' } as ApiResponse);
      return;
    }

    const result = await contractService.listContracts({
      tenantId,
      page: Math.max(1, parseInt(req.query.page as string) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20)),
      type: req.query.type as string | undefined,
      search: req.query.search as string | undefined,
      isActive: req.query.isActive as 'true' | 'false' | undefined,
    });

    res.json({
      success: true,
      data: result.contracts,
      pagination: { page: Math.max(1, parseInt(req.query.page as string) || 1), pageSize: Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20)), total: result.total, totalPages: result.totalPages },
    } as PaginatedResponse);
  } catch (error: any) {
    console.error('获取合同列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { type, name, code, totalAmount, supplierId, awardingParty, description, startDate, endDate } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '合同名称不能为空' } as ApiResponse);
      return;
    }
    if (type && !['PROCUREMENT', 'CONSTRUCTION'].includes(type)) {
      res.status(400).json({ success: false, error: 'INVALID_TYPE', message: '无效合同类型' } as ApiResponse);
      return;
    }

    const contract = await contractService.createContract({
      tenantId, type, name, code, totalAmount, supplierId, awardingParty, description, startDate, endDate,
    });

    await createLog(contractService.makeLogInput(tenantId, req.user!.id, 'CREATE', `创建合同「${name}」`, { type: contract.type, code, totalAmount }, req.ip, req.headers['user-agent']));

    res.status(201).json({ success: true, data: contract, message: '合同创建成功' } as ApiResponse);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: '合同编号已存在' } as ApiResponse);
    } else if (error.status) {
      res.status(error.status).json({ success: false, error: error.code, message: error.message } as ApiResponse);
    } else {
      console.error('创建合同失败:', error);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
    }
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const contract = await contractService.getContractDetail(req.user!.tenantId!, req.params.id);
    if (!contract) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '合同不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: contract } as ApiResponse);
  } catch (error: any) {
    console.error('获取合同详情失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { name, code, totalAmount, supplierId, awardingParty, description, startDate, endDate, type } = req.body;

    const result = await contractService.updateContract(tenantId, id, { name, code, totalAmount, supplierId, awardingParty, description, startDate, endDate, type });

    if (!result) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '合同不存在' } as ApiResponse);
      return;
    }

    await createLog(contractService.makeLogInput(tenantId, req.user!.id, 'UPDATE', `更新合同「${result.oldName}」`, { name, code, totalAmount, type }, req.ip, req.headers['user-agent']));

    res.json({ success: true, data: result.updated, message: '合同更新成功' } as ApiResponse);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: 'DUPLICATE_CODE', message: '合同编号已存在' } as ApiResponse);
    } else {
      console.error('更新合同失败:', error);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
    }
  }
});

router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await contractService.deleteContract(tenantId, req.params.id);

    if (!result) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '合同不存在' } as ApiResponse);
      return;
    }

    await createLog(contractService.makeLogInput(tenantId, req.user!.id, 'DELETE', `删除合同「${result.name}」（软删除）`, undefined, req.ip, req.headers['user-agent']));

    res.json({ success: true, data: { id: result.updated.id, isActive: result.updated.isActive }, message: '合同已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除合同失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

// ============================================
// 进度款管理
// ============================================

router.get('/:id/progress-payments', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await contractService.listProgressPayments(req.user!.tenantId!, req.params.id);
    if (!result.contract) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '合同不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: { payments: result.payments, totalAmount: result.totalAmount, contractTotal: result.contractTotal } } as ApiResponse);
  } catch (error: any) {
    console.error('获取进度款列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

router.post('/:id/progress-payments', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { amount, receivedAt, remark } = req.body;

    if (!amount || !receivedAt) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '收款金额和收款日期不能为空' } as ApiResponse);
      return;
    }

    const result = await contractService.createProgressPayment({ tenantId, contractId: id, amount, receivedAt, remark });

    if (!result.contract) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: '合同不存在' } as ApiResponse);
      return;
    }

    await createLog(contractService.makeLogInput(tenantId, req.user!.id, 'CREATE', `为合同「${result.contract.name}」新增进度款（金额：${amount}）`, undefined, req.ip, req.headers['user-agent']));

    res.status(201).json({ success: true, data: result.payment, message: '进度款添加成功' } as ApiResponse);
  } catch (error: any) {
    console.error('新增进度款失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '服务器错误' } as ApiResponse);
  }
});

export default router;
