import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    personnel: {
      findFirst: vi.fn(),
    },
    paymentRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    salaryRecord: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    attendanceRecord: {
      count: vi.fn(),
    },
    anomaly: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../common/utils/prisma', () => ({
  prisma: prismaMock,
}));

import { confirmPaymentsBatch, createPayment, deletePayment } from './service';

describe('labor payment service lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
  });

  it('creates payment records as unconfirmed and persists bank account without settlement side effects', async () => {
    prismaMock.personnel.findFirst.mockResolvedValue({
      id: 'personnel-1',
      departmentId: 'department-1',
    });
    prismaMock.paymentRecord.create.mockResolvedValue({
      id: 'payment-1',
      recipientName: '张三',
      bankAccount: '6222020202020202020',
      isConfirmed: false,
    });

    const result = await createPayment({
      tenantId: 'tenant-1',
      recipientName: '张三',
      idCardNo: '110101199003010011',
      amount: 88.66,
      bankAccount: '6222020202020202020',
      month: '2026-06',
      remark: '单测创建',
    });

    expect(result.record).toMatchObject({ id: 'payment-1', isConfirmed: false });
    expect(prismaMock.paymentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        personnelId: 'personnel-1',
        departmentId: 'department-1',
        recipientName: '张三',
        amount: 88.66,
        bankAccount: '6222020202020202020',
        month: '2026-06',
        isConfirmed: false,
      }),
    });
    expect(prismaMock.salaryRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.salaryRecord.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.anomaly.create).not.toHaveBeenCalled();
  });

  it('confirms unconfirmed payments and creates risk anomaly only after confirmation', async () => {
    prismaMock.paymentRecord.findFirst.mockResolvedValue({
      id: 'payment-2',
      tenantId: 'tenant-1',
      personnelId: 'personnel-1',
      recipientName: '李四',
      amount: 321,
      month: '2026-05',
      isConfirmed: false,
    });
    prismaMock.salaryRecord.findMany.mockResolvedValue([]);
    prismaMock.paymentRecord.update.mockResolvedValue({
      id: 'payment-2',
      isConfirmed: true,
    });
    prismaMock.paymentRecord.findUnique.mockResolvedValue({
      id: 'payment-2',
      personnelId: 'personnel-1',
      personnel: { name: '李四' },
      recipientName: '李四',
      amount: 321,
      month: '2026-05',
    });
    prismaMock.attendanceRecord.count.mockResolvedValue(0);
    prismaMock.anomaly.create.mockResolvedValue({ id: 'anomaly-1' });

    const result = await confirmPaymentsBatch('tenant-1', ['payment-2']);

    expect(result).toEqual({ count: 1 });
    expect(prismaMock.paymentRecord.update).toHaveBeenCalledWith({
      where: { id: 'payment-2' },
      data: expect.objectContaining({
        isConfirmed: true,
        isAiMatched: false,
      }),
    });
    expect(prismaMock.anomaly.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        personnelId: 'personnel-1',
        level: 'RED',
        abnormalAmount: 321,
      }),
    });
  });

  it('deletes only unconfirmed tenant-scoped payments', async () => {
    prismaMock.paymentRecord.findFirst.mockResolvedValue({
      id: 'payment-3',
      tenantId: 'tenant-1',
      recipientName: '王五',
      amount: 55.55,
      isConfirmed: false,
    });
    prismaMock.paymentRecord.delete.mockResolvedValue({ id: 'payment-3' });

    await expect(deletePayment('tenant-1', 'payment-3')).resolves.toMatchObject({ id: 'payment-3' });

    expect(prismaMock.paymentRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'payment-3', tenantId: 'tenant-1' },
    });
    expect(prismaMock.paymentRecord.delete).toHaveBeenCalledWith({
      where: { id: 'payment-3' },
    });
  });

  it('rejects deleting confirmed payments', async () => {
    prismaMock.paymentRecord.findFirst.mockResolvedValue({
      id: 'payment-4',
      tenantId: 'tenant-1',
      isConfirmed: true,
    });

    await expect(deletePayment('tenant-1', 'payment-4')).rejects.toMatchObject({
      code: 'ALREADY_CONFIRMED',
      message: '已确认发放记录不可删除',
    });
    expect(prismaMock.paymentRecord.delete).not.toHaveBeenCalled();
  });
});
