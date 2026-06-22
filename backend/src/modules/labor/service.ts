// ============================================
// 劳资管理 - 业务逻辑层
// ============================================
// 从 routes.ts 中抽取，所有业务逻辑集中管理
// routes.ts 只负责 HTTP 请求/响应

import path from 'path';
import fs from 'fs';
import { prisma } from '../../common/utils/prisma';
import { AuthenticatedRequest } from '../../common/types';
import { getFaceRecognitionProvider } from './face-provider';

// ============================================
// 辅助函数
// ============================================

export function validateIdCard(idCardNo: string): { valid: boolean; reason?: string } {
  if (!idCardNo || idCardNo.length !== 18) {
    return { valid: false, reason: '身份证号必须为18位' };
  }
  const reg = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  if (!reg.test(idCardNo)) {
    return { valid: false, reason: '身份证号格式不正确' };
  }
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCardNo[i]) * weights[i];
  }
  const expectedCheckCode = checkCodes[sum % 11];
  const actualCheckCode = idCardNo[17].toUpperCase();
  if (actualCheckCode !== expectedCheckCode) {
    return { valid: false, reason: '身份证号校验码不正确' };
  }
  return { valid: true };
}

export function checkAgeCompliance(idCardNo: string): { isUnderAge: boolean; isOverAge: boolean } {
  const year = parseInt(idCardNo.substring(6, 10));
  const month = parseInt(idCardNo.substring(10, 12));
  const day = parseInt(idCardNo.substring(12, 14));
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return { isUnderAge: age < 16, isOverAge: age > 60 };
}

export function validateMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function getNaturalDaysInMonth(month: string): number {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon, 0).getDate();
}

export function attendanceValueToNumber(value: string): number {
  const map: Record<string, number> = { HALF: 0.5, FULL: 1, ONE_HALF: 1.5, DOUBLE: 2 };
  return map[value] || 0;
}

export function overtimeValueToNumber(value: string): number {
  const map: Record<string, number> = { NONE: 0, HALF: 0.5, FULL: 1 };
  return map[value] || 0;
}

export function formatAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function buildMonthRange(month: string) {
  const startDate = new Date(`${month}-01`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return { gte: startDate, lt: endDate };
}

export async function getAccessibleDepartmentIds(req: AuthenticatedRequest): Promise<string[] | null> {
  if (req.user!.type === 'developer') return null;
  const dataScope = req.user!.dataScope;
  if (dataScope === 'ALL') return null;
  if (dataScope === 'OWN_DEPARTMENT' || !dataScope) {
    return req.user!.departmentId ? [req.user!.departmentId] : [];
  }
  if (dataScope === 'DEPARTMENTS') {
    const auths = await prisma.departmentAuthorization.findMany({
      where: { userId: req.user!.id },
      select: { departmentId: true },
    });
    return auths.map(a => a.departmentId);
  }
  return [];
}

// ============================================
// 人员管理
// ============================================

export interface PersonnelListParams {
  tenantId: string;
  type?: string;
  departmentId?: string;
  subContractId?: string;
  search?: string;
  status?: string;
  page: number;
  limit: number;
  accessibleDeptIds: string[] | null;
}

export async function listPersonnel(params: PersonnelListParams) {
  const { tenantId, type, departmentId, subContractId, search, status, page, limit, accessibleDeptIds } = params;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (type) where.type = type;
  if (departmentId) where.departmentId = departmentId;
  if (subContractId) where.subcontractorId = subContractId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { idCardNo: { contains: search } },
    ];
  }
  if (accessibleDeptIds !== null) {
    where.departmentId = { in: accessibleDeptIds };
  }

  const [personnel, total] = await Promise.all([
    prisma.personnel.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        subcontractor: { select: { companyName: true, contactName: true } },
      },
    }),
    prisma.personnel.count({ where }),
  ]);

  const today = new Date();
  const personnelWithWarnings = await Promise.all(
    personnel.map(async (p) => {
      if (p.status !== 'active') {
        return { ...p, consecutiveAbsentDays: 0, absenceWarning: null as string | null };
      }
      const lastAttendance = await prisma.attendanceRecord.findFirst({
        where: { personnelId: p.id },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      const refDate = lastAttendance ? new Date(lastAttendance.date) : p.createdAt;
      const diffMs = today.getTime() - refDate.getTime();
      const consecutiveAbsentDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      let absenceWarning: string | null = null;
      if (consecutiveAbsentDays >= 14) absenceWarning = 'red';
      else if (consecutiveAbsentDays >= 7) absenceWarning = 'yellow';
      return { ...p, consecutiveAbsentDays, absenceWarning };
    })
  );

  return { personnel: personnelWithWarnings, total, page, limit };
}

export async function getPersonnelById(tenantId: string, id: string) {
  const person = await prisma.personnel.findFirst({
    where: { id, tenantId },
    include: {
      department: { select: { id: true, name: true, code: true } },
      subcontractor: { select: { companyName: true, contactName: true } },
      attachments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };
  return person;
}

export interface CreatePersonnelData {
  tenantId: string;
  name: string;
  idCardNo: string;
  phone?: string;
  type: string;
  departmentId: string;
  subcontractorId?: string;
  bankAccount?: string;
  salaryMode?: string;
  monthlySalary?: number;
  dailySalary?: number;
  workerDailySalary?: number;
  socialInsurance?: number;
  remark?: string;
}

export async function createPersonnel(data: CreatePersonnelData) {
  const idCardCheck = validateIdCard(data.idCardNo);
  if (!idCardCheck.valid) throw { status: 400, code: 'INVALID_ID_CARD', message: idCardCheck.reason! };

  const existing = await prisma.personnel.findFirst({
    where: { tenantId: data.tenantId, idCardNo: data.idCardNo },
  });
  if (existing) throw { status: 409, code: 'DUPLICATE_ID_CARD', message: `身份证号 ${data.idCardNo} 已存在（姓名：${existing.name}）` };

  const { isUnderAge, isOverAge } = checkAgeCompliance(data.idCardNo);
  const isDuplicateId = !!(await prisma.personnel.findFirst({
    where: { tenantId: data.tenantId, idCardNo: data.idCardNo, id: { not: undefined } },
  }));

  return prisma.personnel.create({
    data: {
      tenantId: data.tenantId, name: data.name, idCardNo: data.idCardNo,
      phone: data.phone, type: data.type, departmentId: data.departmentId,
      subcontractorId: data.subcontractorId, bankAccount: data.bankAccount,
      salaryMode: data.salaryMode || 'DAILY', monthlySalary: data.monthlySalary,
      dailySalary: data.dailySalary, workerDailySalary: data.workerDailySalary,
      socialInsurance: data.socialInsurance, remark: data.remark,
      status: 'active', isUnderAge, isOverAge, isDuplicateId,
    },
  });
}

export interface UpdatePersonnelData {
  name?: string;
  phone?: string;
  type?: string;
  departmentId?: string;
  subcontractorId?: string;
  bankAccount?: string;
  salaryMode?: string;
  monthlySalary?: number;
  dailySalary?: number;
  workerDailySalary?: number;
  socialInsurance?: number;
  remark?: string;
}

export async function updatePersonnel(tenantId: string, id: string, data: UpdatePersonnelData) {
  const person = await prisma.personnel.findFirst({ where: { id, tenantId } });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };
  return prisma.personnel.update({ where: { id }, data });
}

export async function leavePersonnel(tenantId: string, id: string, leftAt: string) {
  const person = await prisma.personnel.findFirst({ where: { id, tenantId } });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };
  if (person.status === 'left') throw { status: 400, code: 'ALREADY_LEFT', message: '该人员已离职' };
  return prisma.personnel.update({ where: { id }, data: { status: 'left', leftAt: new Date(leftAt) } });
}

export async function rejoinPersonnel(tenantId: string, id: string) {
  const person = await prisma.personnel.findFirst({ where: { id, tenantId } });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };
  if (person.status !== 'left') throw { status: 400, code: 'NOT_LEFT', message: '该人员未离职，无需复职' };
  return prisma.personnel.update({ where: { id }, data: { status: 'rejoin', leftAt: null } });
}

// ============================================
// 考勤管理
// ============================================

export interface CreateAttendanceData {
  tenantId: string;
  personnelId: string;
  date: string;
  value: string;
  overtimeValue: string;
}

export async function createAttendance(data: CreateAttendanceData) {
  const person = await prisma.personnel.findFirst({ where: { id: data.personnelId, tenantId: data.tenantId } });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };

  return prisma.attendanceRecord.upsert({
    where: { personnelId_date: { personnelId: data.personnelId, date: data.date } },
    create: { tenantId: data.tenantId, personnelId: data.personnelId, date: data.date, value: data.value, overtimeValue: data.overtimeValue },
    update: { value: data.value, overtimeValue: data.overtimeValue },
  });
}

export interface BatchAttendanceData {
  tenantId: string;
  records: { personnelId: string; date: string; value: string; overtimeValue: string }[];
}

export async function createBatchAttendance(data: BatchAttendanceData) {
  let created = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < data.records.length; i++) {
    try {
      const r = data.records[i];
      await prisma.attendanceRecord.upsert({
        where: { personnelId_date: { personnelId: r.personnelId, date: r.date } },
        create: { tenantId: data.tenantId, personnelId: r.personnelId, date: r.date, value: r.value, overtimeValue: r.overtimeValue },
        update: { value: r.value, overtimeValue: r.overtimeValue },
      });
      created++;
    } catch (err: any) {
      errors.push({ index: i, error: err.message });
    }
  }
  return { created, errors };
}

export interface AttendanceMonthlyParams {
  tenantId: string;
  month?: string;
  departmentId?: string;
  personnelId?: string;
  accessibleDeptIds: string[] | null;
}

export async function getMonthlyAttendance(params: AttendanceMonthlyParams) {
  const { tenantId, month, departmentId, personnelId, accessibleDeptIds } = params;
  const where: any = { tenantId, status: 'active' };
  if (departmentId) where.departmentId = departmentId;
  if (personnelId) where.id = personnelId;
  if (accessibleDeptIds !== null) where.departmentId = { in: accessibleDeptIds };

  const allPersonnel = await prisma.personnel.findMany({
    where,
    select: { id: true, name: true, idCardNo: true, type: true, department: { select: { name: true } } },
  });

  const attendanceWhere: any = { personnelId: { in: allPersonnel.map(p => p.id) } };
  if (month) {
    attendanceWhere.date = buildMonthRange(month);
  }
  const attendanceRecords = await prisma.attendanceRecord.findMany({ where: attendanceWhere });

  const attendanceMap: Record<string, any[]> = {};
  for (const a of attendanceRecords) {
    if (!attendanceMap[a.personnelId]) attendanceMap[a.personnelId] = [];
    attendanceMap[a.personnelId].push(a);
  }

  return allPersonnel.map(p => {
    const records = attendanceMap[p.id] || [];
    const attendanceDays = records.reduce((s, r) => s + attendanceValueToNumber(r.value), 0);
    const overtimeDays = records.reduce((s, r) => s + overtimeValueToNumber(r.overtimeValue), 0);
    return { ...p, attendanceDays, overtimeDays, records };
  });
}

export interface DailyAttendanceParams {
  tenantId: string;
  date?: string;
  departmentId?: string;
  accessibleDeptIds: string[] | null;
}

export async function getDailyAttendance(params: DailyAttendanceParams) {
  const { tenantId, date, departmentId, accessibleDeptIds } = params;
  const where: any = { tenantId };
  if (date) where.date = date;
  if (departmentId) {
    where.personnel = { departmentId, ...(accessibleDeptIds ? { departmentId: { in: accessibleDeptIds } } : {}) };
  }

  return prisma.attendanceRecord.findMany({
    where,
    include: {
      personnel: {
        select: { name: true, idCardNo: true, type: true, department: { select: { name: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });
}

// ============================================
// 工资核算
// ============================================

export async function calculateSalaryForPersonnel(personnelId: string, month: string, tenantId: string) {
  const [personnel, attendances] = await Promise.all([
    prisma.personnel.findFirst({ where: { id: personnelId, tenantId } }),
    prisma.attendanceRecord.findMany({ where: { personnelId, date: buildMonthRange(month) } }),
  ]);
  if (!personnel) throw new Error('人员不存在');

  const naturalDays = getNaturalDaysInMonth(month);
  const attendanceDays = attendances.reduce((s, a) => s + attendanceValueToNumber(a.value), 0);
  const overtimeDays = attendances.reduce((s, a) => s + overtimeValueToNumber(a.overtimeValue), 0);

  let dailyWage = 0;
  let basePayable = 0;
  let absentDeduction = 0;
  let overtimePay = 0;
  const socialInsuranceDeduction = Number(personnel.socialInsurance ?? 0);

  if (personnel.type === 'STAFF') {
    if (personnel.salaryMode === 'MONTHLY') {
      const monthly = Number(personnel.monthlySalary ?? 0);
      dailyWage = formatAmount(monthly / naturalDays);
      const rawAbsent = naturalDays - attendanceDays;
      const deductibleAbsent = Math.max(0, rawAbsent);
      absentDeduction = formatAmount(deductibleAbsent * dailyWage);
      overtimePay = formatAmount(overtimeDays * dailyWage);
      basePayable = formatAmount(monthly + overtimePay - absentDeduction);
    } else {
      dailyWage = Number(personnel.dailySalary ?? 0);
      basePayable = formatAmount(attendanceDays * dailyWage);
      overtimePay = formatAmount(overtimeDays * dailyWage);
      basePayable = formatAmount(basePayable + overtimePay);
    }
  } else {
    dailyWage = Number(personnel.workerDailySalary ?? 0);
    basePayable = formatAmount(attendanceDays * dailyWage);
    overtimePay = 0;
  }

  const absentDays = naturalDays - attendanceDays;
  const totalPayable = formatAmount(basePayable - (personnel.type === 'STAFF' ? socialInsuranceDeduction : 0));

  return {
    naturalDays, attendanceDays, absentDays: Math.max(0, absentDays),
    overtimeDays, dailyWage, basePayable, absentDeduction, overtimePay,
    socialInsuranceDeduction: personnel.type === 'STAFF' ? socialInsuranceDeduction : 0,
    totalPayable,
  };
}

export interface CalculateSalaryParams {
  tenantId: string;
  month: string;
  departmentId?: string;
  subContractId?: string;
  personnelIds?: string[];
  accessibleDeptIds: string[] | null;
}

export async function calculateSalaryBatch(params: CalculateSalaryParams) {
  const { tenantId, month, departmentId, subContractId, personnelIds, accessibleDeptIds } = params;

  const where: any = { tenantId, status: 'active' };
  if (departmentId) where.departmentId = departmentId;
  if (subContractId) where.subcontractorId = subContractId;
  if (personnelIds?.length) where.id = { in: personnelIds };
  if (accessibleDeptIds !== null) where.departmentId = { in: accessibleDeptIds };

  const allPersonnel = await prisma.personnel.findMany({ where });
  const results = [];
  const errors: Array<{ personnelId: string; name: string; error: string }> = [];

  for (const p of allPersonnel) {
    try {
      const calc = await calculateSalaryForPersonnel(p.id, month, tenantId);
      const paidAgg = await prisma.paymentRecord.aggregate({
        where: { personnelId: p.id, tenantId, isConfirmed: true, month },
        _sum: { amount: true },
      });
      const totalPaid = Number(paidAgg._sum.amount ?? 0);
      const arrearsAmount = formatAmount(calc.totalPayable - totalPaid);

      const salary = await prisma.salaryRecord.upsert({
        where: { personnelId_month: { personnelId: p.id, month } },
        create: { tenantId, personnelId: p.id, month, ...calc, totalPaid, arrearsAmount: Math.max(0, arrearsAmount) },
        update: { ...calc, totalPaid, arrearsAmount: Math.max(0, arrearsAmount), needsRecalculation: false },
      });
      results.push(salary);
    } catch (err: any) {
      errors.push({ personnelId: p.id, name: p.name, error: err.message });
    }
  }

  return { results, errors, total: results.length };
}

export interface SalaryListParams {
  tenantId: string;
  month?: string;
  departmentId?: string;
  personnelId?: string;
  page: number;
  limit: number;
  accessibleDeptIds: string[] | null;
}

export async function listSalaryRecords(params: SalaryListParams) {
  const { tenantId, month, departmentId, personnelId, page, limit, accessibleDeptIds } = params;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (month) where.month = month;
  if (personnelId) where.personnelId = personnelId;
  if (departmentId) where.personnel = { departmentId };
  if (accessibleDeptIds !== null) {
    where.personnel = { ...where.personnel, departmentId: { in: accessibleDeptIds } };
  }

  const [records, total] = await Promise.all([
    prisma.salaryRecord.findMany({
      where, skip, take: limit, orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
      include: {
        personnel: {
          select: {
            name: true, idCardNo: true, type: true, salaryMode: true,
            department: { select: { name: true } },
            subcontractor: { select: { companyName: true, contactName: true } },
          },
        },
      },
    }),
    prisma.salaryRecord.count({ where }),
  ]);

  return { records, total, page, limit };
}

export async function getSalaryRecordById(tenantId: string, id: string) {
  const record = await prisma.salaryRecord.findFirst({
    where: { id, tenantId },
    include: {
      personnel: {
        select: {
          name: true, idCardNo: true, type: true, salaryMode: true,
          department: { select: { name: true } },
          subcontractor: { select: { companyName: true, contactName: true } },
        },
      },
    },
  });
  if (!record) throw { status: 404, code: 'NOT_FOUND', message: '工资记录不存在' };
  return record;
}

export interface UpdateSalaryData {
  overtimePay?: number;
  customAdditions?: any;
  customDeductions?: any;
  totalPayable?: number;
  remark?: string;
}

export async function updateSalaryRecord(tenantId: string, id: string, data: UpdateSalaryData) {
  const record = await prisma.salaryRecord.findFirst({ where: { id, tenantId } });
  if (!record) throw { status: 404, code: 'NOT_FOUND', message: '工资记录不存在' };
  return prisma.salaryRecord.update({ where: { id }, data });
}

export interface SalarySummaryParams {
  tenantId: string;
  month?: string;
  departmentId?: string;
  accessibleDeptIds: string[] | null;
}

export async function getSalarySummary(params: SalarySummaryParams) {
  const { tenantId, month, departmentId, accessibleDeptIds } = params;
  const where: any = { tenantId };
  if (month) where.month = month;
  if (departmentId) where.personnel = { departmentId };
  if (accessibleDeptIds !== null) {
    where.personnel = { ...where.personnel, departmentId: { in: accessibleDeptIds } };
  }

  const agg = await prisma.salaryRecord.aggregate({
    where,
    _sum: { totalPayable: true, totalPaid: true, arrearsAmount: true },
    _count: true,
  });

  return {
    totalPayable: Number(agg._sum.totalPayable ?? 0),
    totalPaid: Number(agg._sum.totalPaid ?? 0),
    totalArrears: Number(agg._sum.arrearsAmount ?? 0),
    recordCount: agg._count,
  };
}

// ============================================
// 工资发放
// ============================================

export async function detectAndCreateAnomalies(paymentId: string, tenantId: string): Promise<void> {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: { personnel: true },
  });
  if (!payment || !payment.personnelId || !payment.month) return;

  const attendanceCount = await prisma.attendanceRecord.count({
    where: { personnelId: payment.personnelId, date: buildMonthRange(payment.month) },
  });

  if (attendanceCount === 0) {
    await prisma.anomaly.create({
      data: {
        tenantId, personnelId: payment.personnelId, level: 'RED',
        description: `${payment.personnel?.name ?? payment.recipientName} 当月无考勤记录，但产生发放金额 ${payment.amount} 元`,
        abnormalAmount: Number(payment.amount),
      },
    });
  }
}

export interface PaymentListParams {
  tenantId: string;
  search?: string;
  month?: string;
  personnelId?: string;
  departmentId?: string;
  isConfirmed?: string;
  page: number;
  limit: number;
  accessibleDeptIds: string[] | null;
}

export async function listPayments(params: PaymentListParams) {
  const { tenantId, search, month, personnelId, departmentId, isConfirmed, page, limit, accessibleDeptIds } = params;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (search) {
    where.OR = [{ recipientName: { contains: search } }, { idCardNo: { contains: search } }];
  }
  if (personnelId) where.personnelId = personnelId;
  if (isConfirmed !== undefined) where.isConfirmed = isConfirmed === 'true';
  if (month) where.month = month;
  if (departmentId) where.departmentId = departmentId;
  if (accessibleDeptIds !== null) where.departmentId = { in: accessibleDeptIds };

  const [records, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        personnel: { select: { name: true, type: true, subcontractor: { select: { companyName: true, contactName: true } } } },
      },
    }),
    prisma.paymentRecord.count({ where }),
  ]);

  return { records, total, page, limit };
}

export interface CreatePaymentData {
  tenantId: string;
  recipientName: string;
  idCardNo: string;
  amount: number;
  paymentDate?: string;
  month?: string;
  paymentMethod?: string;
  departmentId?: string;
  remark?: string;
}

export async function createPayment(data: CreatePaymentData) {
  const matchedPersonnel = await prisma.personnel.findFirst({
    where: { tenantId: data.tenantId, idCardNo: data.idCardNo, status: 'active' },
  });

  const arrearsOffset: Array<{ month: string; amount: number }> = [];
  let remainingAmount = data.amount;

  if (matchedPersonnel) {
    const arrearsRecords = await prisma.salaryRecord.findMany({
      where: { personnelId: matchedPersonnel.id, arrearsAmount: { gt: 0 } },
      orderBy: { month: 'asc' },
    });

    for (const record of arrearsRecords) {
      if (remainingAmount <= 0) break;
      const arrears = Number(record.arrearsAmount);
      const deduct = Math.min(remainingAmount, arrears);
      arrearsOffset.push({ month: record.month, amount: deduct });
      remainingAmount = formatAmount(remainingAmount - deduct);

      await prisma.salaryRecord.update({
        where: { id: record.id },
        data: { arrearsAmount: formatAmount(arrears - deduct), totalPaid: { increment: deduct } },
      });
    }
  }

  const resolvedMonth = data.month || (data.paymentDate ? new Date(data.paymentDate).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7));

  const record = await prisma.paymentRecord.create({
    data: {
      tenantId: data.tenantId,
      personnelId: matchedPersonnel?.id ?? undefined,
      departmentId: data.departmentId || matchedPersonnel?.departmentId || undefined,
      recipientName: data.recipientName,
      idCardNo: data.idCardNo,
      amount: data.amount,
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      month: resolvedMonth,
      paymentMethod: data.paymentMethod || undefined,
      arrearsOffset: arrearsOffset.length > 0 ? JSON.stringify(arrearsOffset) : undefined,
      isConfirmed: true,
      remark: data.remark || undefined,
    },
  });

  if (matchedPersonnel && record.month) {
    const currentMonthAmount = remainingAmount > 0
      ? formatAmount(data.amount - arrearsOffset.reduce((s, o) => s + o.amount, 0))
      : 0;
    if (currentMonthAmount > 0) {
      await prisma.salaryRecord.updateMany({
        where: { personnelId: matchedPersonnel.id, month: record.month },
        data: { totalPaid: { increment: currentMonthAmount }, arrearsAmount: { decrement: currentMonthAmount } },
      });
    }
  }

  await detectAndCreateAnomalies(record.id, data.tenantId);

  return { record, arrearsOffset };
}

export async function confirmPaymentsBatch(tenantId: string, ids: string[]) {
  return prisma.paymentRecord.updateMany({
    where: { id: { in: ids }, tenantId, isConfirmed: false },
    data: { isConfirmed: true },
  });
}

export async function confirmPaymentAi(tenantId: string, id: string) {
  const payment = await prisma.paymentRecord.findFirst({ where: { id, tenantId } });
  if (!payment) throw { status: 404, code: 'NOT_FOUND', message: '发放记录不存在' };
  if (payment.isConfirmed) throw { status: 400, code: 'ALREADY_CONFIRMED', message: '该记录已确认' };

  const updated = await prisma.paymentRecord.update({
    where: { id },
    data: { isConfirmed: true, isAiMatched: true },
  });

  await detectAndCreateAnomalies(id, tenantId);
  return updated;
}

// ============================================
// 分包商管理
// ============================================

export interface SubcontractorListParams {
  tenantId: string;
  search?: string;
  page: number;
  limit: number;
}

export async function listSubcontractors(params: SubcontractorListParams) {
  const { tenantId, search, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: any = { tenantId, isActive: true };
  if (search) {
    where.OR = [
      { companyName: { contains: search } },
      { contactName: { contains: search } },
      { contactPhone: { contains: search } },
    ];
  }

  const [subcontractors, total] = await Promise.all([
    prisma.subcontractor.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.subcontractor.count({ where }),
  ]);

  return { subcontractors, total, page, limit };
}

export interface CreateSubcontractorData {
  tenantId: string;
  type?: string;
  companyName: string;
  contactName?: string;
  contactPhone?: string;
  idCardNo?: string;
  address?: string;
  bankAccount?: string;
  bankName?: string;
  remark?: string;
}

export async function createSubcontractor(data: CreateSubcontractorData) {
  return prisma.subcontractor.create({ data: data as any });
}

export async function updateSubcontractor(tenantId: string, id: string, data: Partial<CreateSubcontractorData>) {
  const sub = await prisma.subcontractor.findFirst({ where: { id, tenantId } });
  if (!sub) throw { status: 404, code: 'NOT_FOUND', message: '分包商不存在' };
  return prisma.subcontractor.update({ where: { id }, data });
}

export async function deleteSubcontractor(tenantId: string, id: string) {
  const sub = await prisma.subcontractor.findFirst({ where: { id, tenantId } });
  if (!sub) throw { status: 404, code: 'NOT_FOUND', message: '分包商不存在' };

  const personnelCount = await prisma.personnel.count({ where: { subcontractorId: id } });
  if (personnelCount > 0) throw { status: 400, code: 'HAS_PERSONNEL', message: `该分包商下有 ${personnelCount} 名人员，无法删除` };

  return prisma.subcontractor.update({ where: { id }, data: { isActive: false } });
}

// ============================================
// 分包合同管理
// ============================================

export interface SubContractListParams {
  tenantId: string;
  contractId?: string;
  subcontractorId?: string;
  page: number;
  limit: number;
}

export async function listSubContracts(params: SubContractListParams) {
  const { tenantId, contractId, subcontractorId, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: any = { tenantId, isActive: true };
  if (contractId) where.contractId = contractId;
  if (subcontractorId) where.subcontractorId = subcontractorId;

  const [contracts, total] = await Promise.all([
    prisma.subContract.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        contract: { select: { name: true } },
        subcontractor: { select: { companyName: true, contactName: true, type: true } },
        outputValues: { select: { amount: true, payableRatio: true } },
        subProgressPayments: { select: { totalAmount: true } },
      },
    }),
    prisma.subContract.count({ where }),
  ]);

  return { contracts, total, page, limit };
}

export interface CreateSubContractData {
  tenantId: string;
  contractId: string;
  subcontractorId: string;
  name?: string;
  totalAmount?: number;
}

export async function createSubContract(data: CreateSubContractData) {
  return prisma.subContract.create({
    data: {
      tenantId: data.tenantId,
      contractId: data.contractId,
      subcontractorId: data.subcontractorId,
      name: data.name || '',
      totalAmount: data.totalAmount,
    },
  });
}

export async function updateSubContract(tenantId: string, id: string, data: Partial<CreateSubContractData>) {
  const contract = await prisma.subContract.findFirst({ where: { id, tenantId } });
  if (!contract) throw { status: 404, code: 'NOT_FOUND', message: '分包合同不存在' };
  return prisma.subContract.update({ where: { id }, data });
}

export async function deleteSubContract(tenantId: string, id: string) {
  const contract = await prisma.subContract.findFirst({ where: { id, tenantId } });
  if (!contract) throw { status: 404, code: 'NOT_FOUND', message: '分包合同不存在' };
  return prisma.subContract.update({ where: { id }, data: { isActive: false } });
}

// ============================================
// 产值管理
// ============================================

export async function checkOverpayAlert(subContractId: string, tenantId: string, newPayment: number): Promise<void> {
  const [subContract, totalPaid, totalPayable] = await Promise.all([
    prisma.subContract.findUnique({ where: { id: subContractId } }),
    prisma.subProgressPayment.aggregate({ where: { subContractId, tenantId }, _sum: { totalAmount: true } }),
    prisma.outputValue.findMany({ where: { subContractId, tenantId }, select: { amount: true, payableRatio: true } }),
  ]);

  const totalPaidAmount = Number(totalPaid._sum.totalAmount ?? 0);
  const totalPayableAmount = totalPayable.reduce((s, o) => s + Number(o.amount) * Number(o.payableRatio ?? 1), 0);
  const totalOutput = totalPayable.reduce((s, o) => s + Number(o.amount), 0);

  if (totalPaidAmount > totalOutput) {
    console.warn(`[风控] 超付红色预警：分包合同 ${subContractId}，支付 ${totalPaidAmount} 超过产值总额 ${totalOutput}`);
  } else if (totalPaidAmount > totalPayableAmount) {
    console.warn(`[风控] 超付黄色预警：分包合同 ${subContractId}，支付 ${totalPaidAmount} 超过应付 ${totalPayableAmount}`);
  }
}

export interface CreateOutputValueData {
  tenantId: string;
  subContractId: string;
  month: string;
  amount: number;
  payableRatio?: number;
  remark?: string;
}

export async function createOutputValue(data: CreateOutputValueData) {
  if (!data.subContractId || !data.month || !data.amount) {
    throw { status: 400, code: 'MISSING_PARAMS', message: '分包合同、月份和金额为必填项' };
  }
  if (!validateMonth(data.month)) throw { status: 400, code: 'INVALID_MONTH', message: '月份格式错误，应为 YYYY-MM' };

  const contract = await prisma.subContract.findFirst({ where: { id: data.subContractId, tenantId: data.tenantId } });
  if (!contract) throw { status: 404, code: 'NOT_FOUND', message: '分包合同不存在' };

  return prisma.outputValue.create({ data: data as any });
}

export interface OutputValueListParams {
  tenantId: string;
  subContractId?: string;
  month?: string;
}

export async function listOutputValues(params: OutputValueListParams) {
  const { tenantId, subContractId, month } = params;
  const where: any = { tenantId };
  if (subContractId) where.subContractId = subContractId;
  if (month) where.month = month;

  return prisma.outputValue.findMany({
    where,
    orderBy: { month: 'desc' },
    include: {
      subContract: {
        include: { subcontractor: { select: { companyName: true, contactName: true } } },
      },
    },
  });
}

export interface CreateProgressPaymentData {
  tenantId: string;
  subContractId: string;
  totalAmount: number;
  outputValueIds?: string[];
  paidAt?: string;
  remark?: string;
}

export async function createProgressPayment(data: CreateProgressPaymentData) {
  if (!data.subContractId || !data.totalAmount) {
    throw { status: 400, code: 'MISSING_PARAMS', message: '分包合同和支付总额为必填项' };
  }

  const payment = await prisma.subProgressPayment.create({
    data: {
      tenantId: data.tenantId,
      subContractId: data.subContractId,
      totalAmount: data.totalAmount,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      remark: data.remark,
      outputValues: data.outputValueIds?.length
        ? { create: data.outputValueIds.map((oid: string) => ({ outputValueId: oid })) }
        : undefined,
    },
  });

  await checkOverpayAlert(data.subContractId, data.tenantId, data.totalAmount);
  return payment;
}

// ============================================
// 风控异常
// ============================================

export interface AnomalyListParams {
  tenantId: string;
  level?: string;
  isResolved?: string;
  month?: string;
  page: number;
  limit: number;
  accessibleDeptIds: string[] | null;
}

export async function listAnomalies(params: AnomalyListParams) {
  const { tenantId, level, isResolved, month, page, limit, accessibleDeptIds } = params;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (level) where.level = level;
  if (isResolved !== undefined) where.isResolved = isResolved === 'true';
  if (accessibleDeptIds !== null) {
    where.personnel = { departmentId: { in: accessibleDeptIds } };
  }

  const [anomalies, total] = await Promise.all([
    prisma.anomaly.findMany({
      where, skip, take: limit, orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
      include: {
        personnel: {
          select: {
            name: true, idCardNo: true, type: true,
            department: { select: { name: true } },
            subcontractor: { select: { companyName: true, contactName: true } },
          },
        },
      },
    }),
    prisma.anomaly.count({ where }),
  ]);

  return { anomalies, total, page, limit };
}

export async function resolveAnomaly(tenantId: string, id: string, resolveReason: string) {
  const anomaly = await prisma.anomaly.findFirst({ where: { id, tenantId } });
  if (!anomaly) throw { status: 404, code: 'NOT_FOUND', message: '异常记录不存在' };
  if (anomaly.isResolved) throw { status: 400, code: 'ALREADY_RESOLVED', message: '该异常已取消' };

  return prisma.anomaly.update({
    where: { id },
    data: { isResolved: true, resolvedAt: new Date(), resolveReason: resolveReason.trim() },
  });
}

export async function getAnomalyStats(tenantId: string) {
  const [redCount, yellowCount, totalAbnormalAmount, unresolvedCount, complianceWarnings] = await Promise.all([
    prisma.anomaly.count({ where: { tenantId, level: 'RED', isResolved: false } }),
    prisma.anomaly.count({ where: { tenantId, level: 'YELLOW', isResolved: false } }),
    prisma.anomaly.aggregate({ where: { tenantId, isResolved: false }, _sum: { abnormalAmount: true } }),
    prisma.anomaly.count({ where: { tenantId, isResolved: false } }),
    prisma.personnel.count({
      where: { tenantId, status: 'active', OR: [{ isUnderAge: true }, { isOverAge: true }, { isDuplicateId: true }] },
    }),
  ]);

  const subcontractorAnomalies = await prisma.$queryRaw<any[]>`
    SELECT
      s.id as subcontractor_id,
      COALESCE(s."companyName", s."contactName") as subcontractor_name,
      CAST(COUNT(a.id) AS INTEGER) as anomaly_count,
      COALESCE(SUM(a."abnormalAmount"), 0) as total_abnormal_amount
    FROM anomalies a
    JOIN personnel p ON a."personnelId" = p.id
    JOIN subcontractors s ON p."subcontractorId" = s.id
    WHERE a."tenantId" = ${tenantId}
      AND a."isResolved" = false
    GROUP BY s.id, s."companyName", s."contactName"
    ORDER BY total_abnormal_amount DESC
    LIMIT 10
  `;

  return {
    summary: {
      redCount, yellowCount,
      totalAbnormalAmount: Number(totalAbnormalAmount._sum.abnormalAmount ?? 0),
      unresolvedCount, complianceWarnings,
    },
    subcontractorAnomalies,
    disclaimer: '本页面所有数据仅用于内部风险监控，非直接追责依据',
  };
}

// ============================================
// 微信小程序打卡 / 人脸 / 异常县份
// ============================================

function normalizeDateOnly(input?: string | Date): Date {
  const source = input ? new Date(input) : new Date();
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

function normalizeCounty(county?: string | null, countyCode?: string | null): string {
  return (countyCode || county || '').trim();
}

async function assertLaborEnabledForTenant(tenantId: string) {
  const entitlement = await prisma.tenantModuleEntitlement.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey: 'labor' } },
  });
  if (entitlement && !entitlement.isEnabled) {
    throw { status: 403, code: 'MODULE_DISABLED', message: '该企业未开通劳资管理模块，无法使用小程序打卡' };
  }
}

export async function enrollPersonnelFace(tenantId: string, personnelId: string, photoUrl: string, provider = 'stub') {
  const person = await prisma.personnel.findFirst({ where: { id: personnelId, tenantId } });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };
  return prisma.personnel.update({
    where: { id: personnelId },
    data: {
      facePhotoUrl: photoUrl,
      faceProvider: provider,
      faceStatus: 'enrolled',
      faceUpdatedAt: new Date(),
    },
  });
}

export async function getAttendanceSetting(tenantId: string) {
  return prisma.attendanceSetting.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, checkInsPerDay: 1, faceProvider: 'stub' },
  });
}

export async function updateAttendanceSetting(tenantId: string, data: { checkInsPerDay?: number; faceProvider?: string }) {
  const checkInsPerDay = data.checkInsPerDay === 2 ? 2 : 1;
  return prisma.attendanceSetting.upsert({
    where: { tenantId },
    update: { checkInsPerDay, faceProvider: data.faceProvider || 'stub' },
    create: { tenantId, checkInsPerDay, faceProvider: data.faceProvider || 'stub' },
  });
}

export async function listMobileCheckIns(params: {
  tenantId: string;
  status?: string;
  personnelId?: string;
  date?: string;
  page: number;
  limit: number;
}) {
  const { tenantId, status, personnelId, date, page, limit } = params;
  const where: any = { tenantId };
  if (status) where.status = status;
  if (personnelId) where.personnelId = personnelId;
  if (date) where.checkDate = normalizeDateOnly(date);
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    prisma.mobileCheckInRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        personnel: {
          select: {
            id: true,
            name: true,
            phone: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.mobileCheckInRecord.count({ where }),
  ]);
  return { records, total, page, limit };
}

export async function listTrustedCheckInLocations(tenantId: string, personnelId?: string) {
  return prisma.trustedCheckInLocation.findMany({
    where: { tenantId, ...(personnelId ? { personnelId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { personnel: { select: { id: true, name: true, phone: true } } },
  });
}

export async function addTrustedCheckInLocation(data: {
  tenantId: string;
  personnelId: string;
  province?: string;
  city?: string;
  county: string;
  countyCode?: string;
  remark?: string;
  createdBy?: string;
}) {
  const person = await prisma.personnel.findFirst({ where: { id: data.personnelId, tenantId: data.tenantId } });
  if (!person) throw { status: 404, code: 'NOT_FOUND', message: '人员不存在' };
  const location = await prisma.trustedCheckInLocation.upsert({
    where: { personnelId_county: { personnelId: data.personnelId, county: data.county } },
    update: {
      province: data.province,
      city: data.city,
      countyCode: data.countyCode,
      remark: data.remark,
      createdBy: data.createdBy,
    },
    create: {
      tenantId: data.tenantId,
      personnelId: data.personnelId,
      province: data.province,
      city: data.city,
      county: data.county,
      countyCode: data.countyCode,
      remark: data.remark,
      createdBy: data.createdBy,
    },
  });

  await prisma.mobileCheckInRecord.updateMany({
    where: { tenantId: data.tenantId, personnelId: data.personnelId, county: data.county, status: 'abnormal' },
    data: { status: 'trusted', resolvedAt: new Date(), resolveReason: `已添加为个人信任打卡地：${data.county}` },
  });
  return location;
}

export async function batchResolveMobileCheckIns(tenantId: string, ids: string[], resolveReason: string) {
  if (!ids.length) throw { status: 400, code: 'MISSING_PARAMS', message: '请选择要处理的异常打卡记录' };
  const result = await prisma.mobileCheckInRecord.updateMany({
    where: { tenantId, id: { in: ids }, status: 'abnormal' },
    data: { status: 'resolved', resolvedAt: new Date(), resolveReason: resolveReason || '批量处理异常' },
  });
  return { count: result.count };
}

export async function resolveTenantByMiniProgram(appId?: string, phone?: string) {
  if (!phone) throw { status: 400, code: 'MISSING_PARAMS', message: '手机号不能为空' };
  if (!appId) throw { status: 400, code: 'MISSING_PARAMS', message: '小程序 appId 不能为空' };
  const config = await prisma.miniProgramConfig.findUnique({ where: { appId }, include: { tenant: true } });
  if (!config) throw { status: 404, code: 'MINI_PROGRAM_NOT_FOUND', message: '未找到该小程序接入配置' };
  if (config && !config.isEnabled) throw { status: 403, code: 'MINI_PROGRAM_DISABLED', message: '该小程序接入已停用' };
  if (config?.tenantId) {
    const person = await prisma.personnel.findFirst({ where: { tenantId: config.tenantId, phone, status: { not: 'left' } } });
    if (!person) throw { status: 404, code: 'PERSONNEL_NOT_FOUND', message: '该企业未找到匹配手机号的人员' };
    await assertLaborEnabledForTenant(config.tenantId);
    return { tenantId: config.tenantId, personnel: person, matchedBy: 'tenant_app' };
  }

  const matches = await prisma.personnel.findMany({
    where: { phone, status: { not: 'left' }, tenant: { isActive: true, deletedAt: null } },
    include: { tenant: { select: { id: true, name: true, code: true } } },
    take: 10,
  });
  if (!matches.length) throw { status: 404, code: 'PERSONNEL_NOT_FOUND', message: '未找到匹配手机号的人员' };
  const tenantIds = [...new Set(matches.map((item) => item.tenantId))];
  if (tenantIds.length > 1) {
    return {
      multiple: true,
      code: 'MULTIPLE_TENANTS',
      candidates: matches.map((item) => ({ tenantId: item.tenantId, tenantName: item.tenant.name, tenantCode: item.tenant.code, personnelId: item.id, personnelName: item.name })),
    };
  }
  await assertLaborEnabledForTenant(tenantIds[0]);
  return { tenantId: tenantIds[0], personnel: matches[0], matchedBy: config?.isDefault ? 'default_app' : 'phone' };
}

export async function createMobileCheckIn(data: {
  appId?: string;
  tenantId?: string;
  phone: string;
  checkDate?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  province?: string;
  city?: string;
  county?: string;
  countyCode?: string;
  photoUrl?: string;
}) {
  const resolved = data.tenantId
    ? {
        tenantId: data.tenantId,
        personnel: await prisma.personnel.findFirst({ where: { tenantId: data.tenantId, phone: data.phone, status: { not: 'left' } } }),
      }
    : await resolveTenantByMiniProgram(data.appId, data.phone);

  if ((resolved as any).multiple) return resolved;
  const tenantId = (resolved as any).tenantId as string;
  const personnel = (resolved as any).personnel;
  if (!personnel) throw { status: 404, code: 'PERSONNEL_NOT_FOUND', message: '未找到匹配手机号的人员' };
  await assertLaborEnabledForTenant(tenantId);

  const setting = await getAttendanceSetting(tenantId);
  const checkDate = normalizeDateOnly(data.checkDate);
  const existingCount = await prisma.mobileCheckInRecord.count({
    where: { tenantId, personnelId: personnel.id, checkDate },
  });
  if (existingCount >= setting.checkInsPerDay) {
    throw { status: 409, code: 'CHECK_IN_LIMIT_REACHED', message: `当天已完成 ${setting.checkInsPerDay} 次打卡` };
  }

  const countyKey = normalizeCounty(data.county, data.countyCode);
  const trusted = countyKey
    ? await prisma.trustedCheckInLocation.findFirst({
        where: {
          tenantId,
          personnelId: personnel.id,
          OR: [{ county: data.county || countyKey }, ...(data.countyCode ? [{ countyCode: data.countyCode }] : [])],
        },
      })
    : null;
  const normalHistory = countyKey
    ? await prisma.mobileCheckInRecord.findFirst({
        where: {
          tenantId,
          personnelId: personnel.id,
          status: { in: ['normal', 'trusted', 'resolved'] },
          county: { not: null },
        },
        orderBy: { createdAt: 'asc' },
      })
    : null;
  const shouldBeAbnormal = Boolean(countyKey && normalHistory && !trusted && normalizeCounty(normalHistory.county, normalHistory.countyCode) !== countyKey);
  const faceProvider = setting.faceProvider || personnel.faceProvider || 'stub';
  const faceResult = await getFaceRecognitionProvider(faceProvider).verify({
    provider: faceProvider,
    personnelId: personnel.id,
    referencePhotoUrl: personnel.facePhotoUrl,
    checkInPhotoUrl: data.photoUrl,
  });

  const record = await prisma.mobileCheckInRecord.create({
    data: {
      tenantId,
      personnelId: personnel.id,
      appId: data.appId,
      phone: data.phone,
      checkDate,
      sequenceNo: existingCount + 1,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      province: data.province,
      city: data.city,
      county: data.county,
      countyCode: data.countyCode,
      photoUrl: data.photoUrl,
      faceProvider: faceResult.provider,
      faceStatus: faceResult.status,
      status: shouldBeAbnormal ? 'abnormal' : trusted ? 'trusted' : 'normal',
      abnormalReason: shouldBeAbnormal ? `离开平时打卡县份：${normalHistory?.county || '未知'}，本次：${data.county || countyKey}` : undefined,
    },
    include: { personnel: { select: { id: true, name: true, phone: true } } },
  });

  await prisma.attendanceRecord.upsert({
    where: { personnelId_date: { personnelId: personnel.id, date: checkDate } },
    create: { tenantId, personnelId: personnel.id, date: checkDate, value: 'FULL', overtimeValue: 'NONE', remark: '小程序打卡自动同步' },
    update: { value: 'FULL', remark: '小程序打卡自动同步' },
  });

  return { record, face: faceResult };
}

export async function getComplianceWarnings(tenantId: string, accessibleDeptIds: string[] | null) {
  const where: any = {
    tenantId, status: 'active',
    OR: [{ isUnderAge: true }, { isOverAge: true }, { isDuplicateId: true }],
  };
  if (accessibleDeptIds !== null) where.departmentId = { in: accessibleDeptIds };

  return prisma.personnel.findMany({
    where,
    select: {
      id: true, name: true, idCardNo: true, phone: true, type: true,
      isUnderAge: true, isOverAge: true, isDuplicateId: true,
      department: { select: { name: true } },
      subcontractor: { select: { companyName: true, contactName: true } },
    },
  });
}

// ============================================
// 报表导出
// ============================================

export async function getMonthlySalaryData(tenantId: string, months: string[], departmentId?: string) {
  const where: any = { tenantId };
  if (months.length === 1) where.month = months[0];
  else where.month = { in: months };
  if (departmentId) where.personnel = { departmentId };

  const records = await prisma.salaryRecord.findMany({
    where,
    include: {
      personnel: {
        select: {
          name: true, idCardNo: true, phone: true, type: true, salaryMode: true,
          department: { select: { name: true } },
          subcontractor: { select: { companyName: true, contactName: true } },
        },
      },
    },
    orderBy: [{ month: 'asc' }, { createdAt: 'asc' }],
  });

  return records.map((r, i) => ({
    '序号': i + 1, '月份': r.month, '姓名': r.personnel.name, '身份证号': r.personnel.idCardNo,
    '联系电话': r.personnel.phone, '所属类型': r.personnel.type === 'STAFF' ? '项目部' : '务工人员',
    '所属项目部': r.personnel.department?.name ?? '', '所属分包商': r.personnel.subcontractor?.companyName ?? r.personnel.subcontractor?.contactName ?? '',
    '薪资模式': r.personnel.salaryMode === 'MONTHLY' ? '月薪制' : '日薪制', '自然天数': r.naturalDays,
    '出勤天数': Number(r.attendanceDays), '加班天数': Number(r.overtimeDays), '单日工资': Number(r.dailyWage),
    '基础应发工资': Number(r.basePayable), '缺勤扣款': Number(r.absentDeduction), '加班费': Number(r.overtimePay),
    '社保个人扣除': Number(r.socialInsuranceDeduction), '应发工资': Number(r.totalPayable),
    '实发工资': Number(r.totalPaid), '欠薪金额': Number(r.arrearsAmount), '备注': r.remark ?? '',
  }));
}

export async function getArrearsData(tenantId: string, months: string[], departmentId?: string) {
  const where: any = { tenantId, arrearsAmount: { gt: 0 } };
  if (months.length) where.month = months.length === 1 ? months[0] : { in: months };
  if (departmentId) where.personnel = { departmentId };

  const records = await prisma.salaryRecord.findMany({
    where,
    include: {
      personnel: {
        select: {
          name: true, idCardNo: true, phone: true, bankAccount: true,
          subcontractor: { select: { companyName: true, contactName: true } },
        },
      },
    },
    orderBy: [{ personnel: { name: 'asc' } }, { month: 'asc' }],
  });

  return records.map((r, i) => ({
    '序号': i + 1, '月份': r.month, '姓名': r.personnel.name, '身份证号': r.personnel.idCardNo,
    '联系电话': r.personnel.phone, '银行卡号': r.personnel.bankAccount ?? '',
    '所属分包商': r.personnel.subcontractor?.companyName ?? r.personnel.subcontractor?.contactName ?? '项目部',
    '应发工资': Number(r.totalPayable), '实发工资': Number(r.totalPaid), '欠薪金额': Number(r.arrearsAmount),
  }));
}

export async function getAnomalyData(tenantId: string, months: string[], departmentId?: string) {
  const where: any = { tenantId };
  if (months.length) where.month = months.length === 1 ? months[0] : { in: months };

  const anomalies = await prisma.anomaly.findMany({
    where,
    include: {
      personnel: {
        select: {
          name: true, idCardNo: true, phone: true,
          department: { select: { name: true } },
          subcontractor: { select: { companyName: true, contactName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return anomalies.map((a, i) => ({
    '序号': i + 1, '异常等级': a.level === 'RED' ? '红色一级异常' : '黄色二级预警',
    '月份': a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 7) : '', '姓名': a.personnel.name, '身份证号': a.personnel.idCardNo,
    '联系电话': a.personnel.phone,
    '所属分包商': a.personnel.subcontractor?.companyName ?? a.personnel.subcontractor?.contactName ?? '项目部',
    '异常描述': a.description, '异常金额': Number(a.abnormalAmount),
    '是否已处理': a.isResolved ? '已取消' : '未处理', '取消原因': a.resolveReason ?? '',
    '取消时间': a.resolvedAt ? new Date(a.resolvedAt).toLocaleDateString('zh-CN') : '',
    '创建时间': new Date(a.createdAt).toLocaleDateString('zh-CN'),
  }));
}

export async function getPaymentData(tenantId: string, months: string[], departmentId?: string) {
  const where: any = { tenantId, isConfirmed: true };
  if (months.length) {
    where.month = months.length === 1 ? months[0] : { in: months };
  }
  if (departmentId) where.departmentId = departmentId;

  const records = await prisma.paymentRecord.findMany({
    where,
    include: {
      personnel: {
        select: {
          name: true, type: true, bankAccount: true,
          subcontractor: { select: { companyName: true, contactName: true } },
        },
      },
    },
    orderBy: [{ paymentDate: 'asc' }],
  });

  return records.map((r, i) => ({
    '序号': i + 1, '发放月份': r.month ?? '', '收款人姓名': r.recipientName,
    '身份证号': r.idCardNo ?? '', '发放金额': Number(r.amount), '银行卡号': r.personnel?.bankAccount ?? '',
    '发放日期': r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('zh-CN') : '',
    '发放方式': r.paymentMethod ?? '',
    '所属分包商': r.personnel?.subcontractor?.companyName ?? r.personnel?.subcontractor?.contactName ?? '项目部',
    '来源': r.isAiMatched ? 'AI识别' : '手动录入', '备注': r.remark ?? '',
  }));
}

export async function getAvailableMonths(tenantId: string) {
  const [salaryMonths, paymentMonths] = await Promise.all([
    prisma.salaryRecord.findMany({ where: { tenantId }, select: { month: true }, distinct: ['month'], orderBy: { month: 'desc' } }),
    prisma.paymentRecord.findMany({ where: { tenantId, isConfirmed: true, month: { not: null } }, select: { month: true }, distinct: ['month'], orderBy: { month: 'desc' } }),
  ]);

  const allMonths = new Set([
    ...salaryMonths.map(r => r.month),
    ...paymentMonths.map(r => r.month!).filter(Boolean),
  ]);

  return [...allMonths].sort().reverse();
}

export interface DashboardStatsParams {
  tenantId: string;
  year?: string;
  month?: string;
  mode: string;
  accessibleDeptIds: string[] | null;
}

export async function getDashboardStats(params: DashboardStatsParams) {
  const { tenantId, year, month, mode, accessibleDeptIds } = params;

  const salaryWhere: any = { tenantId };
  const paymentWhere: any = { tenantId, isConfirmed: true };

  if (mode === 'month' && month) {
    salaryWhere.month = month;
    paymentWhere.month = month;
  } else if (mode === 'year' && year) {
    salaryWhere.month = { startsWith: year };
    paymentWhere.month = { startsWith: year };
  }

  if (accessibleDeptIds !== null && accessibleDeptIds.length > 0) {
    salaryWhere.personnel = { departmentId: { in: accessibleDeptIds } };
  }

  const [salaryAgg, paymentAgg, arrearsAgg, anomalyCount, personnelCount] = await Promise.all([
    prisma.salaryRecord.aggregate({ where: salaryWhere, _sum: { totalPayable: true, totalPaid: true, arrearsAmount: true }, _count: true }),
    prisma.paymentRecord.aggregate({ where: paymentWhere, _sum: { amount: true }, _count: true }),
    prisma.salaryRecord.aggregate({ where: { ...salaryWhere, arrearsAmount: { gt: 0 } }, _sum: { arrearsAmount: true }, _count: true }),
    prisma.anomaly.count({ where: { tenantId, isResolved: false } }),
    prisma.personnel.count({ where: { tenantId, status: 'active' } }),
  ]);

  const monthlyTrend = await prisma.$queryRaw<any[]>`
    SELECT month,
      CAST(SUM("totalPayable") AS REAL) as payable,
      CAST(SUM("totalPaid") AS REAL) as paid,
      CAST(SUM("arrearsAmount") AS REAL) as arrears
    FROM salary_records
    WHERE "tenantId" = ${tenantId}
      AND month LIKE ${year ? year + '%' : '%'}
    GROUP BY month
    ORDER BY month ASC
  `;

  return {
    totalPayable: Number(salaryAgg._sum.totalPayable ?? 0),
    totalPaid: Number(salaryAgg._sum.totalPaid ?? 0),
    totalArrears: Number(salaryAgg._sum.arrearsAmount ?? 0),
    paymentTotal: Number(paymentAgg._sum.amount ?? 0),
    paymentCount: paymentAgg._count,
    arrearsPersonnelCount: arrearsAgg._count,
    anomalyCount, personnelCount, monthlyTrend,
  };
}

export interface ReportPreviewParams {
  tenantId: string;
  months: string[];
  type: string;
  departmentId?: string;
}

export async function getReportPreview(params: ReportPreviewParams) {
  const { tenantId, months, type, departmentId } = params;
  switch (type) {
    case 'salary': return getMonthlySalaryData(tenantId, months, departmentId);
    case 'arrears': return getArrearsData(tenantId, months, departmentId);
    case 'anomaly': return getAnomalyData(tenantId, months, departmentId);
    case 'payment': return getPaymentData(tenantId, months, departmentId);
    default: return [];
  }
}

export async function getReportExportData(tenantId: string, monthList: string[], departmentId?: string) {
  return Promise.all([
    getMonthlySalaryData(tenantId, monthList, departmentId),
    getArrearsData(tenantId, monthList, departmentId),
    getAnomalyData(tenantId, monthList, departmentId),
    getPaymentData(tenantId, monthList, departmentId),
  ]);
}

// ============================================
// 附件管理
// ============================================

export async function createAttachments(tenantId: string, files: Express.Multer.File[], entityType: string, entityId: string, category?: string) {
  return prisma.$transaction(
    files.map(file =>
      prisma.attachment.create({
        data: {
          tenantId, fileName: file.originalname, storedName: file.filename,
          filePath: `/uploads/${file.filename}`, fileSize: file.size, mimeType: file.mimetype,
          entityType, entityId, category: category || 'other',
        },
      })
    )
  );
}

export interface AttachmentListParams {
  tenantId: string;
  entityType?: string;
  entityId?: string;
}

export async function listAttachments(params: AttachmentListParams) {
  return prisma.attachment.findMany({
    where: { tenantId: params.tenantId, entityType: params.entityType, entityId: params.entityId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteAttachment(tenantId: string, id: string, uploadDir: string) {
  const attachment = await prisma.attachment.findFirst({ where: { id, tenantId } });
  if (!attachment) throw { status: 404, code: 'NOT_FOUND', message: '附件不存在' };

  const fullPath = path.join(uploadDir, attachment.storedName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await prisma.attachment.delete({ where: { id } });
  return attachment;
}
