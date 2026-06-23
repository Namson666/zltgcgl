// ============================================
// 劳资管理（Labor）路由模块（HTTP层）
// ============================================
// 只负责：解析请求参数、调用服务层、返回响应
// 业务逻辑全部在 service.ts 中
//
// 10 个子路由模块：
// 1. personnel（人员管理） 2. attendance（考勤管理）
// 3. salary（工资核算） 4. payment（工资发放）
// 5. subcontractor（分包商管理） 6. subContract（分包合同管理）
// 7. outputValue（产值管理） 8. anomaly（风控异常）
// 9. report（报表导出） 10. attachment（附件管理）

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { authenticate, requireUser } from '../../common/middleware/auth';
import { requirePermission } from '../../common/middleware/permission';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../../common/types';
import { createLog } from '../../common/services/log.service';
import * as laborService from './service';

const router = Router();

function addJsonWorksheet(workbook: ExcelJS.Workbook, name: string, rows: Record<string, any>[] = []) {
  const worksheet = workbook.addWorksheet(name);
  const keys = [...new Set(rows.flatMap(row => Object.keys(row || {})))];
  if (!keys.length) {
    worksheet.addRow(['暂无数据']);
    return worksheet;
  }
  worksheet.columns = keys.map(key => ({ header: key, key, width: Math.max(12, Math.min(32, key.length * 2)) }));
  rows.forEach(row => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  return worksheet;
}

// ============================================
// 附件上传配置
// ============================================

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================
// 1. 人员管理路由（personnel）
// ============================================

const personnelRouter = Router();

personnelRouter.get('/', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { type, departmentId, subContractId, search, status, page = '1', limit = '50' } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);

    if (accessibleDeptIds !== null && accessibleDeptIds.length === 0) {
      res.json({ success: true, data: { personnel: [], total: 0, page: parseInt(page), limit: parseInt(limit) } } as ApiResponse);
      return;
    }

    const data = await laborService.listPersonnel({
      tenantId, type, departmentId, subContractId, search, status,
      page: parseInt(page), limit: parseInt(limit), accessibleDeptIds,
    });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取人员列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取人员列表过程中发生服务器错误' } as ApiResponse);
  }
});

personnelRouter.get('/:id', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const data = await laborService.getPersonnelById(tenantId, req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取人员详情失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

personnelRouter.post('/', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, idCardNo, phone, type, departmentId, subcontractorId, bankAccount, salaryMode, monthlySalary, dailySalary, workerDailySalary, socialInsurance, remark } = req.body;

    if (!name || !idCardNo || !type || !departmentId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '姓名、身份证号、人员类型和项目部为必填项' } as ApiResponse);
      return;
    }

    const person = await laborService.createPersonnel({ tenantId, name, idCardNo, phone, type, departmentId, subcontractorId, bankAccount, salaryMode, monthlySalary, dailySalary, workerDailySalary, socialInsurance, remark });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '人员管理', description: `入职人员「${name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: person, message: '人员入职成功' } as ApiResponse);
  } catch (error: any) {
    console.error('人员入职失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

personnelRouter.put('/:id', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, phone, type, departmentId, subcontractorId, bankAccount, salaryMode, monthlySalary, dailySalary, workerDailySalary, socialInsurance, remark } = req.body;
    const updated = await laborService.updatePersonnel(tenantId, req.params.id, { name, phone, type, departmentId, subcontractorId, bankAccount, salaryMode, monthlySalary, dailySalary, workerDailySalary, socialInsurance, remark });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '人员管理', description: `更新人员信息「${updated.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '人员信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新人员信息失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

personnelRouter.post('/:id/leave', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const leftAt = req.body.leftAt || req.body.leaveDate;
    if (!leftAt) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '离职日期为必填项' } as ApiResponse);
      return;
    }
    const updated = await laborService.leavePersonnel(tenantId, req.params.id, leftAt);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '人员管理', description: `人员离职「${updated.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '人员已离职' } as ApiResponse);
  } catch (error: any) {
    console.error('人员离职失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

personnelRouter.post('/:id/rejoin', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const updated = await laborService.rejoinPersonnel(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '人员管理', description: `人员复职「${updated.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '人员已复职' } as ApiResponse);
  } catch (error: any) {
    console.error('人员复职失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

personnelRouter.post('/:id/face', authenticate, requireUser, requirePermission('canManagePersonnel'), upload.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!req.file) {
      res.status(400).json({ success: false, error: 'MISSING_FILE', message: '请上传人员人脸照片' } as ApiResponse);
      return;
    }
    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ success: false, error: 'INVALID_FILE', message: '人脸照片仅支持图片' } as ApiResponse);
      return;
    }
    const updated = await laborService.enrollPersonnelFace(tenantId, req.params.id, `/uploads/${req.file.filename}`);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '人员管理', description: `录入人员人脸照片「${updated.name}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '人脸照片已录入' } as ApiResponse);
  } catch (error: any) {
    console.error('录入人脸照片失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/personnel', personnelRouter);

// ============================================
// 2. 考勤管理路由（attendance）
// ============================================

const attendanceRouter = Router();

attendanceRouter.post('/', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { personnelId, date, value, overtimeValue } = req.body;
    if (!personnelId || !date || !value) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '人员、日期和出勤值为必填项' } as ApiResponse);
      return;
    }
    const record = await laborService.createAttendance({ tenantId, personnelId, date, value, overtimeValue: overtimeValue || 'NONE' });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '考勤管理', description: `录入考勤：${date}`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: record, message: '考勤录入成功' } as ApiResponse);
  } catch (error: any) {
    console.error('录入考勤失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

attendanceRouter.post('/batch', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { records } = req.body;
    if (!records?.length) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '考勤记录不能为空' } as ApiResponse);
      return;
    }
    const result = await laborService.createBatchAttendance({ tenantId, records });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '考勤管理', description: `批量录入考勤：${result.created} 条`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: result, message: `成功录入 ${result.created} 条考勤` } as ApiResponse);
  } catch (error: any) {
    console.error('批量录入考勤失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '批量录入考勤过程中发生服务器错误' } as ApiResponse);
  }
});

attendanceRouter.get('/monthly', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, departmentId, personnelId } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.getMonthlyAttendance({ tenantId, month, departmentId, personnelId, accessibleDeptIds });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取月度考勤汇总失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取月度考勤汇总过程中发生服务器错误' } as ApiResponse);
  }
});

attendanceRouter.get('/', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { date, departmentId } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.getDailyAttendance({ tenantId, date, departmentId, accessibleDeptIds });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取考勤记录失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取考勤记录过程中发生服务器错误' } as ApiResponse);
  }
});

attendanceRouter.get('/mobile/settings', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await laborService.getAttendanceSetting(req.user!.tenantId!);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取打卡规则失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取打卡规则失败' } as ApiResponse);
  }
});

attendanceRouter.put('/mobile/settings', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await laborService.updateAttendanceSetting(req.user!.tenantId!, {
      checkInsPerDay: Number(req.body.checkInsPerDay),
      faceProvider: req.body.faceProvider,
    });
    res.json({ success: true, data, message: '打卡规则已保存' } as ApiResponse);
  } catch (error: any) {
    console.error('保存打卡规则失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '保存打卡规则失败' } as ApiResponse);
  }
});

attendanceRouter.get('/mobile/check-ins', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, personnelId, date, page = '1', limit = '50' } = req.query as any;
    const data = await laborService.listMobileCheckIns({
      tenantId: req.user!.tenantId!,
      status,
      personnelId,
      date,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取移动打卡记录失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取移动打卡记录失败' } as ApiResponse);
  }
});

attendanceRouter.post('/mobile/check-ins/resolve-batch', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await laborService.batchResolveMobileCheckIns(req.user!.tenantId!, req.body.ids || [], req.body.resolveReason || '批量处理异常');
    res.json({ success: true, data, message: `已处理 ${data.count} 条异常打卡` } as ApiResponse);
  } catch (error: any) {
    console.error('批量处理异常打卡失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

attendanceRouter.get('/mobile/trusted-locations', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await laborService.listTrustedCheckInLocations(req.user!.tenantId!, req.query.personnelId as string | undefined);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取信任打卡地失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取信任打卡地失败' } as ApiResponse);
  }
});

attendanceRouter.post('/mobile/trusted-locations', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { personnelId, province, city, county, countyCode, remark } = req.body;
    if (!personnelId || !county) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '人员和县份不能为空' } as ApiResponse);
      return;
    }
    const data = await laborService.addTrustedCheckInLocation({ tenantId: req.user!.tenantId!, personnelId, province, city, county, countyCode, remark, createdBy: req.user!.id });
    res.status(201).json({ success: true, data, message: '已添加个人信任打卡地' } as ApiResponse);
  } catch (error: any) {
    console.error('添加信任打卡地失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

attendanceRouter.delete('/mobile/trusted-locations/:id', authenticate, requireUser, requirePermission('canManageAttendance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await laborService.deleteTrustedCheckInLocation(req.user!.tenantId!, req.params.id);
    res.json({ success: true, data, message: '个人信任打卡地已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除信任打卡地失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/attendance', attendanceRouter);

// ============================================
// 3. 工资核算路由（salary）
// ============================================

const salaryRouter = Router();

salaryRouter.post('/calculate', authenticate, requireUser, requirePermission('canManageSalary'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, departmentId, subContractId, personnelIds } = req.body;

    if (!month || !laborService.validateMonth(month)) {
      res.status(400).json({ success: false, error: 'INVALID_PARAMS', message: '月份格式错误，应为 YYYY-MM' } as ApiResponse);
      return;
    }

    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.calculateSalaryBatch({ tenantId, month, departmentId, subContractId, personnelIds, accessibleDeptIds });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '工资核算', description: `核算月份 ${month}，共 ${data.total} 人`, detail: { month, count: data.total, errors: data.errors }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('工资核算失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '工资核算过程中发生服务器错误' } as ApiResponse);
  }
});

salaryRouter.get('/', authenticate, requireUser, requirePermission('canManageSalary'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, departmentId, personnelId, page = '1', limit = '50' } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);

    if (accessibleDeptIds !== null && accessibleDeptIds.length === 0) {
      res.json({ success: true, data: { records: [], total: 0, page: parseInt(page), limit: parseInt(limit) } } as ApiResponse);
      return;
    }

    const data = await laborService.listSalaryRecords({
      tenantId, month, departmentId, personnelId,
      page: parseInt(page), limit: parseInt(limit), accessibleDeptIds,
    });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取工资核算列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取工资核算列表过程中发生服务器错误' } as ApiResponse);
  }
});

salaryRouter.get('/summary', authenticate, requireUser, requirePermission('canManageSalary'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, departmentId } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.getSalarySummary({ tenantId, month, departmentId, accessibleDeptIds });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取工资汇总失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取工资汇总过程中发生服务器错误' } as ApiResponse);
  }
});

salaryRouter.get('/export', authenticate, requireUser, requirePermission('canManageSalary'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, departmentId } = req.query as any;
    if (!month || !laborService.validateMonth(month)) {
      res.status(400).json({ success: false, error: 'INVALID_PARAMS', message: '月份格式错误，应为 YYYY-MM' } as ApiResponse);
      return;
    }

    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.listSalaryRecords({
      tenantId,
      month,
      departmentId,
      page: 1,
      limit: 10000,
      accessibleDeptIds,
    });

    const rows = data.records.map((r: any, i: number) => ({
      '序号': i + 1,
      '月份': r.month,
      '姓名': r.personnel?.name ?? '',
      '人员类型': r.personnel?.type === 'STAFF' ? '项目部' : '务工人员',
      '所属单位': r.personnel?.subcontractor?.companyName ?? r.personnel?.subcontractor?.contactName ?? r.personnel?.department?.name ?? '',
      '出勤天数': Number(r.attendanceDays ?? 0),
      '加班天数': Number(r.overtimeDays ?? 0),
      '应发工资': Number(r.totalPayable ?? 0),
      '社保扣除': Number(r.socialInsuranceDeduction ?? 0),
      '扣除合计': Number(r.totalDeductions ?? 0),
      '实发工资': Number(r.totalPaid ?? 0),
      '欠薪金额': Number(r.arrearsAmount ?? 0),
      '状态': r.needsRecalculation ? '需重算' : (r.isManuallyEdited ? '已手改' : '正常'),
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '资料通工程管理系统';
    workbook.created = new Date();
    addJsonWorksheet(workbook, '工资核算明细', rows);
    const buf = await workbook.xlsx.writeBuffer();

    await createLog({ tenantId, userId: req.user!.id, action: 'EXPORT', module: '工资核算', description: `导出工资核算报表 ${month}`, detail: { month, count: rows.length }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(`${month}工资核算明细`)}.xlsx"`);
    res.send(buf);
  } catch (error: any) {
    console.error('导出工资核算失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '导出工资核算过程中发生服务器错误' } as ApiResponse);
  }
});

salaryRouter.get('/:id', authenticate, requireUser, requirePermission('canManageSalary'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const data = await laborService.getSalaryRecordById(tenantId, req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取工资记录失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

salaryRouter.put('/:id', authenticate, requireUser, requirePermission('canManageSalary'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { overtimePay, customAdditions, customDeductions, totalPayable, remark } = req.body;
    const oldRecord = await laborService.getSalaryRecordById(tenantId, req.params.id);
    const updated = await laborService.updateSalaryRecord(tenantId, req.params.id, { overtimePay, customAdditions, customDeductions, totalPayable, remark });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '工资核算', description: `修改工资记录「${oldRecord.personnel.name} - ${oldRecord.month}」`, detail: { before: oldRecord, after: updated }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '工资记录修改成功' } as ApiResponse);
  } catch (error: any) {
    console.error('修改工资记录失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/salary', salaryRouter);

// ============================================
// 4. 工资发放路由（payment）
// ============================================

const paymentRouter = Router();

paymentRouter.get('/export', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { search, month, personnelId, departmentId, isConfirmed } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.listPayments({
      tenantId,
      search,
      month,
      personnelId,
      departmentId,
      isConfirmed,
      page: 1,
      limit: 10000,
      accessibleDeptIds,
    });

    const rows = data.records.map((r: any, i: number) => ({
      '序号': i + 1,
      '发放月份': r.month ?? '',
      '收款人': r.recipientName,
      '身份证号': r.idCardNo ?? '',
      '人员类型': r.personnel?.type === 'STAFF' ? '项目部' : (r.personnel?.type === 'WORKER' ? '务工' : '外部'),
      '发放金额': Number(r.amount ?? 0),
      '银行卡号': r.bankAccount ?? '',
      '发放日期': r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('zh-CN') : '',
      '确认状态': r.isConfirmed ? '已确认' : '待确认',
      '确认时间': r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('zh-CN') : '',
      '备注': r.remark ?? '',
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '资料通工程管理系统';
    workbook.created = new Date();
    addJsonWorksheet(workbook, '工资发放明细', rows);
    const buf = await workbook.xlsx.writeBuffer();

    await createLog({ tenantId, userId: req.user!.id, action: 'EXPORT', module: '工资发放', description: '导出工资发放明细', detail: { month, search, count: rows.length }, ip: req.ip, userAgent: req.headers['user-agent'] });
    const suffix = month ? `${month}工资发放明细` : '工资发放明细';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(suffix)}.xlsx"`);
    res.send(buf);
  } catch (error: any) {
    console.error('导出工资发放失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '导出工资发放过程中发生服务器错误' } as ApiResponse);
  }
});

paymentRouter.get('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { search, month, personnelId, departmentId, isConfirmed, page = '1', limit = '50' } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);

    if (accessibleDeptIds !== null && accessibleDeptIds.length === 0) {
      res.json({ success: true, data: { records: [], total: 0, page: parseInt(page), limit: parseInt(limit) } } as ApiResponse);
      return;
    }

    const data = await laborService.listPayments({
      tenantId, search, month, personnelId, departmentId, isConfirmed,
      page: parseInt(page), limit: parseInt(limit), accessibleDeptIds,
    });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取发放记录失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取发放记录过程中发生服务器错误' } as ApiResponse);
  }
});

paymentRouter.post('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { recipientName, idCardNo, amount, bankAccount, paymentDate, month, paymentMethod, departmentId, remark } = req.body;

    if (!recipientName || !idCardNo || !amount) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '收款人姓名、身份证号、发放金额为必填项' } as ApiResponse);
      return;
    }
    if (parseFloat(amount) <= 0) {
      res.status(400).json({ success: false, error: 'INVALID_AMOUNT', message: '发放金额必须大于0' } as ApiResponse);
      return;
    }

    const { record, arrearsOffset } = await laborService.createPayment({
      tenantId, recipientName, idCardNo, amount: parseFloat(amount),
      bankAccount, paymentDate, month, paymentMethod, departmentId, remark,
    });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '工资发放', description: `录入发放：${recipientName}，金额：${amount}元`, detail: { recipientName, amount, arrearsOffset }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: record, message: '发放记录录入成功' } as ApiResponse);
  } catch (error: any) {
    console.error('录入发放记录失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '录入发放记录过程中发生服务器错误' } as ApiResponse);
  }
});

paymentRouter.delete('/:id', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const deleted = await laborService.deletePayment(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'DELETE', module: '工资发放', description: `删除未确认发放：${deleted.recipientName}，金额：${deleted.amount}元`, detail: { id: deleted.id, recipientName: deleted.recipientName, amount: deleted.amount }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { id: deleted.id }, message: '发放记录已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除发放记录失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '删除发放记录过程中发生服务器错误' } as ApiResponse);
  }
});

paymentRouter.post('/confirm-batch', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const ids = req.body?.ids || req.body?.paymentIds;
    if (!ids?.length) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请选择要确认的记录' } as ApiResponse);
      return;
    }
    const updated = await laborService.confirmPaymentsBatch(tenantId, ids);
    await createLog({ tenantId, userId: req.user!.id, action: 'CONFIRM', module: '工资发放', description: `批量确认发放：${updated.count} 条`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: { count: updated.count }, message: `成功确认 ${updated.count} 条发放记录` } as ApiResponse);
  } catch (error: any) {
    console.error('批量确认发放失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '批量确认发放过程中发生服务器错误' } as ApiResponse);
  }
});

paymentRouter.post('/:id/ai-confirm', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const updated = await laborService.confirmPaymentAi(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'CONFIRM', module: '工资发放', description: `AI确认发放：${updated.recipientName}，金额：${updated.amount}元`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: 'AI识别发放已确认' } as ApiResponse);
  } catch (error: any) {
    console.error('AI确认发放失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/payment', paymentRouter);

// ============================================
// 5. 分包商管理路由（subcontractor）
// ============================================

const subcontractorRouter = Router();

subcontractorRouter.get('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { search, page = '1', limit = '50' } = req.query as any;
    const data = await laborService.listSubcontractors({ tenantId, search, page: parseInt(page), limit: parseInt(limit) });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取分包商列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取分包商列表过程中发生服务器错误' } as ApiResponse);
  }
});

subcontractorRouter.post('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { type, companyName, contactName, contactPhone, idCardNo, address, bankAccount, bankName, remark } = req.body;
    if (!companyName) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '公司名称为必填项' } as ApiResponse);
      return;
    }
    const sub = await laborService.createSubcontractor({ tenantId, type, companyName, contactName, contactPhone, idCardNo, address, bankAccount, bankName, remark });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '分包商管理', description: `创建分包商「${companyName}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: sub, message: '分包商创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建分包商失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

subcontractorRouter.put('/:id', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { type, companyName, contactName, contactPhone, idCardNo, address, bankAccount, bankName, remark } = req.body;
    const updated = await laborService.updateSubcontractor(tenantId, req.params.id, { type, companyName, contactName, contactPhone, idCardNo, address, bankAccount, bankName, remark });
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '分包商管理', description: '更新分包商信息', ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '分包商信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新分包商失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

subcontractorRouter.delete('/:id', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    await laborService.deleteSubcontractor(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'DELETE', module: '分包商管理', description: '删除分包商', ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: null, message: '分包商已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除分包商失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/subcontractor', subcontractorRouter);

// ============================================
// 6. 分包合同管理路由（subContract）
// ============================================

const subContractRouter = Router();

subContractRouter.get('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { contractId, subcontractorId, page = '1', limit = '20' } = req.query as any;
    const data = await laborService.listSubContracts({ tenantId, contractId, subcontractorId, page: parseInt(page), limit: parseInt(limit) });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取分包合同列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取分包合同列表过程中发生服务器错误' } as ApiResponse);
  }
});

subContractRouter.post('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { contractId, subcontractorId, name, totalAmount } = req.body;
    if (!contractId || !subcontractorId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '绑定承包合同和分包商为必填项' } as ApiResponse);
      return;
    }
    const contract = await laborService.createSubContract({ tenantId, contractId, subcontractorId, name, totalAmount: totalAmount ? parseFloat(totalAmount) : undefined });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '分包合同管理', description: `创建分包合同「${name || ''}」`, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: contract, message: '分包合同创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('创建分包合同失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

subContractRouter.put('/:id', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, totalAmount } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (totalAmount !== undefined) data.totalAmount = parseFloat(totalAmount);
    const updated = await laborService.updateSubContract(tenantId, req.params.id, data);
    await createLog({ tenantId, userId: req.user!.id, action: 'UPDATE', module: '分包合同管理', description: '更新分包合同信息', ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: updated, message: '分包合同信息更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('更新分包合同失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

subContractRouter.delete('/:id', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    await laborService.deleteSubContract(tenantId, req.params.id);
    await createLog({ tenantId, userId: req.user!.id, action: 'DELETE', module: '分包合同管理', description: '删除分包合同', ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: null, message: '分包合同已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除分包合同失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/sub-contract', subContractRouter);

// ============================================
// 7. 产值管理路由（outputValue）
// ============================================

const outputValueRouter = Router();

outputValueRouter.post('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { subContractId, month, amount, payableRatio, remark } = req.body;
    const output = await laborService.createOutputValue({
      tenantId, subContractId, month,
      amount: parseFloat(amount),
      payableRatio: payableRatio ? parseFloat(payableRatio) : undefined,
      remark,
    });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '产值管理', description: `录入产值：${month}，金额：${amount}元`, detail: output, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: output, message: '产值录入成功' } as ApiResponse);
  } catch (error: any) {
    console.error('录入产值失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

outputValueRouter.get('/', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { subContractId, month } = req.query as any;
    const data = await laborService.listOutputValues({ tenantId, subContractId, month });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取产值列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取产值列表过程中发生服务器错误' } as ApiResponse);
  }
});

outputValueRouter.post('/payments', authenticate, requireUser, requirePermission('canManagePayment'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { subContractId, totalAmount, outputValueIds, paidAt, remark } = req.body;
    const payment = await laborService.createProgressPayment({
      tenantId, subContractId,
      totalAmount: parseFloat(totalAmount),
      outputValueIds, paidAt, remark,
    });
    await createLog({ tenantId, userId: req.user!.id, action: 'CREATE', module: '产值支付', description: `分包进度款支付：${totalAmount}元`, detail: payment, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, data: payment, message: '进度款支付记录创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('录入分包进度款支付失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/output-value', outputValueRouter);

// ============================================
// 8. 风控异常路由（anomaly）
// ============================================

const anomalyRouter = Router();

anomalyRouter.get('/', authenticate, requireUser, requirePermission('canManageAnomaly'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { level, isResolved, month, page = '1', limit = '50' } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);

    if (accessibleDeptIds !== null && accessibleDeptIds.length === 0) {
      res.json({ success: true, data: { anomalies: [], total: 0, page: parseInt(page), limit: parseInt(limit) } } as ApiResponse);
      return;
    }

    const data = await laborService.listAnomalies({
      tenantId, level, isResolved, month,
      page: parseInt(page), limit: parseInt(limit), accessibleDeptIds,
    });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取异常列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取异常列表过程中发生服务器错误' } as ApiResponse);
  }
});

anomalyRouter.post('/:id/resolve', authenticate, requireUser, requirePermission('canManageAnomaly'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { resolveReason } = req.body;
    if (!resolveReason || resolveReason.trim().length < 5) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '取消原因不能为空，且至少5个字符' } as ApiResponse);
      return;
    }
    const anomaly = await laborService.resolveAnomaly(tenantId, req.params.id, resolveReason);
    await createLog({ tenantId, userId: req.user!.id, action: 'CANCEL', module: '风控管理', description: `取消异常：原因：${resolveReason}`, detail: { anomalyId: req.params.id, resolveReason }, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: anomaly, message: '异常已取消' } as ApiResponse);
  } catch (error: any) {
    console.error('取消异常失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

anomalyRouter.get('/stats', authenticate, requireUser, requirePermission('canManageAnomaly'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const data = await laborService.getAnomalyStats(tenantId);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取风控统计失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取风控统计过程中发生服务器错误' } as ApiResponse);
  }
});

anomalyRouter.get('/compliance', authenticate, requireUser, requirePermission('canManageAnomaly'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    if (accessibleDeptIds !== null && accessibleDeptIds.length === 0) {
      res.json({ success: true, data: [] } as ApiResponse);
      return;
    }
    const data = await laborService.getComplianceWarnings(tenantId, accessibleDeptIds);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取合规预警列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取合规预警列表过程中发生服务器错误' } as ApiResponse);
  }
});

router.use('/anomalies', anomalyRouter);

// ============================================
// 9. 报表导出路由（report）
// ============================================

const reportRouter = Router();

reportRouter.get('/available-months', authenticate, requireUser, requirePermission('canManageReport'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const data = await laborService.getAvailableMonths(tenantId);
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取可用月份失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取可用月份过程中发生服务器错误' } as ApiResponse);
  }
});

reportRouter.get('/preview', authenticate, requireUser, requirePermission('canManageReport'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { months, type, departmentId } = req.query as any;
    const monthList: string[] = months ? months.split(',').filter(Boolean) : [];
    const rows = await laborService.getReportPreview({ tenantId, months: monthList, type, departmentId });
    const headers = [...new Set((rows || []).flatMap((row: Record<string, any>) => Object.keys(row || {})))];
    const reportLabels: Record<string, string> = {
      salary: '月度工资汇总表',
      attendance: '月度考勤汇总表',
      payment: '工资发放明细表',
      social: '社保缴纳明细表',
      arrears: '欠薪统计表',
      anomaly: '异常人员明细表',
    };
    res.json({
      success: true,
      data: {
        title: `${monthList.join('、') || '未选择月份'} ${reportLabels[type] || '劳资报表'}`,
        headers,
        rows: (rows || []).map((row: Record<string, any>) => headers.map((header) => row?.[header])),
        summary: { rowCount: rows?.length || 0 },
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('预览报表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '预览报表过程中发生服务器错误' } as ApiResponse);
  }
});

reportRouter.get('/dashboard-stats', authenticate, requireUser, requirePermission('canManageReport'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { year, month, mode = 'month' } = req.query as any;
    const accessibleDeptIds = await laborService.getAccessibleDepartmentIds(req);
    const data = await laborService.getDashboardStats({ tenantId, year, month, mode, accessibleDeptIds });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取数据看板统计失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取数据看板统计过程中发生服务器错误' } as ApiResponse);
  }
});

reportRouter.get('/export', authenticate, requireUser, requirePermission('canManageReport'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { months, departmentId, filename } = req.query as any;
    const monthList: string[] = months ? months.split(',').filter(Boolean) : [];

    if (!monthList.length) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '请选择至少一个月份' } as ApiResponse);
      return;
    }

    const [salaryData, arrearsData, anomalyData, paymentData] = await laborService.getReportExportData(tenantId, monthList, departmentId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '资料通工程管理系统';
    workbook.created = new Date();
    addJsonWorksheet(workbook, '月度工资汇总表', salaryData);
    addJsonWorksheet(workbook, '欠薪统计表', arrearsData);
    addJsonWorksheet(workbook, '异常人员明细表', anomalyData);
    addJsonWorksheet(workbook, '工资发放记录表', paymentData);

    const sorted = [...monthList].sort();
    let exportName = filename;
    if (!exportName) {
      const fmtMonth = (m: string) => m.replace('-', '.').replace(/\.0/, '.');
      exportName = sorted.length === 1
        ? `${fmtMonth(sorted[0])}劳资报表`
        : `${fmtMonth(sorted[0])}~${fmtMonth(sorted[sorted.length - 1])}劳资报表`;
    }

    const buf = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(exportName)}.xlsx"`);
    res.send(buf);
  } catch (error: any) {
    console.error('导出报表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '导出报表过程中发生服务器错误' } as ApiResponse);
  }
});

router.use('/reports', reportRouter);

// ============================================
// 10. 附件管理路由（attachment）
// ============================================

const attachmentRouter = Router();

attachmentRouter.post('/upload', authenticate, requireUser, requirePermission('canManagePersonnel'), upload.array('files', 20), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { entityType, entityId, category } = req.body;

    if (!entityType || !entityId) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: '实体类型和实体ID为必填项' } as ApiResponse);
      return;
    }
    if (!req.files?.length) {
      res.status(400).json({ success: false, error: 'MISSING_FILES', message: '请选择要上传的文件' } as ApiResponse);
      return;
    }

    const files = req.files as Express.Multer.File[];
    const saved = await laborService.createAttachments(tenantId, files, entityType, entityId, category);
    res.status(201).json({ success: true, data: saved, message: `成功上传 ${saved.length} 个文件` } as ApiResponse);
  } catch (error: any) {
    console.error('上传附件失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '上传附件过程中发生服务器错误' } as ApiResponse);
  }
});

attachmentRouter.get('/', authenticate, requireUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { entityType, entityId } = req.query as any;
    const data = await laborService.listAttachments({ tenantId, entityType, entityId });
    res.json({ success: true, data } as ApiResponse);
  } catch (error: any) {
    console.error('获取附件列表失败:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '获取附件列表过程中发生服务器错误' } as ApiResponse);
  }
});

attachmentRouter.delete('/:id', authenticate, requireUser, requirePermission('canManagePersonnel'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    await laborService.deleteAttachment(tenantId, req.params.id, uploadDir);
    res.json({ success: true, data: null, message: '附件已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('删除附件失败:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || '服务器错误' } as ApiResponse);
  }
});

router.use('/attachment', attachmentRouter);

export default router;
