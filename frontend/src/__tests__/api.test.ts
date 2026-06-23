import { beforeEach, describe, expect, it, vi } from 'vitest';

const { httpMock, ocrClientMock } = vi.hoisted(() => ({
  httpMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
  ocrClientMock: {
    post: vi.fn(),
  },
}));

vi.mock('../api/client', () => ({
  http: httpMock,
  ocrClient: ocrClientMock,
}));

import { laborApi } from '../api';

describe('laborApi legacy subcontract output-value endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts subcontract progress payments to the backend route mounted under output-value', () => {
    const payload = {
      subContractId: 'sub-contract-1',
      totalAmount: 1200,
      outputValueIds: ['output-value-1'],
      paidAt: '2026-06-24',
      remark: '进度款路径回归',
    };

    laborApi.createSubProgressPayment(payload);

    expect(httpMock.post).toHaveBeenCalledWith('/labor/output-value/payments', payload);
  });

  it('requests face provider diagnostics without exposing provider secrets in the frontend', () => {
    laborApi.getFaceProviderStatus('http');

    expect(httpMock.get).toHaveBeenCalledWith('/labor/attendance/mobile/face-provider/status', { provider: 'http' });
  });
});
