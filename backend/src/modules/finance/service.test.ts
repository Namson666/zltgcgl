import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    finExpense: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../common/utils/prisma', () => ({
  prisma: prismaMock,
}));

import { approveExpense, createExpense, rejectExpense } from './service';

describe('finance service expense safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults payer to handler for project department reimbursements', async () => {
    prismaMock.finExpense.create.mockResolvedValue({ id: 'expense-1' });

    await createExpense({
      tenantId: 'tenant-1',
      source: 'project_department',
      enteredBy: 'user-1',
      contractId: 'contract-1',
      departmentId: 'department-1',
      handler: '项目部经办人',
      categoryId: 'category-1',
      amount: 88.8,
      paymentMethod: 'company_direct',
      payer: '',
      expenseDate: '2026-06-23',
      detail: '项目部报账',
    });

    expect(prismaMock.finExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payer: '项目部经办人',
          source: 'project_department',
        }),
      }),
    );
  });

  it('approves expenses only inside the requested tenant', async () => {
    prismaMock.finExpense.findFirst.mockResolvedValue({ id: 'expense-1', status: 'pending' });
    prismaMock.finExpense.update.mockResolvedValue({ id: 'expense-1', status: 'approved' });

    await approveExpense('tenant-1', 'expense-1', 'reviewer-1');

    expect(prismaMock.finExpense.findFirst).toHaveBeenCalledWith({
      where: { id: 'expense-1', tenantId: 'tenant-1' },
    });
    expect(prismaMock.finExpense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'expense-1' },
        data: expect.objectContaining({
          status: 'approved',
          reviewedBy: 'reviewer-1',
        }),
      }),
    );
  });

  it('rejects expenses only inside the requested tenant', async () => {
    prismaMock.finExpense.findFirst.mockResolvedValue({ id: 'expense-2', status: 'pending' });
    prismaMock.finExpense.update.mockResolvedValue({ id: 'expense-2', status: 'rejected' });

    await rejectExpense('tenant-1', 'expense-2', 'reviewer-1');

    expect(prismaMock.finExpense.findFirst).toHaveBeenCalledWith({
      where: { id: 'expense-2', tenantId: 'tenant-1' },
    });
    expect(prismaMock.finExpense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'expense-2' },
        data: expect.objectContaining({
          status: 'rejected',
          reviewedBy: 'reviewer-1',
        }),
      }),
    );
  });
});
