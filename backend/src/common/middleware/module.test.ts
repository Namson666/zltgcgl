import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

const { isTenantModuleEnabledMock } = vi.hoisted(() => ({
  isTenantModuleEnabledMock: vi.fn(),
}));

vi.mock('../services/module-entitlement.service', () => ({
  isTenantModuleEnabled: isTenantModuleEnabledMock,
}));

import { requireTenantModule } from './module';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

describe('requireTenantModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when token does not contain tenantId', async () => {
    const req = { user: { id: 'dev-1', type: 'developer' } } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireTenantModule('wms')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'INVALID_TOKEN',
      }),
    );
    expect(isTenantModuleEnabledMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when tenant module is not enabled', async () => {
    isTenantModuleEnabledMock.mockResolvedValue(false);
    const req = { user: { id: 'user-1', type: 'user', tenantId: 'tenant-1' } } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireTenantModule('labor')(req, res, next);

    expect(isTenantModuleEnabledMock).toHaveBeenCalledWith('tenant-1', 'labor');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'MODULE_NOT_ENABLED',
        data: { moduleKey: 'labor' },
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when tenant module is enabled', async () => {
    isTenantModuleEnabledMock.mockResolvedValue(true);
    const req = { user: { id: 'user-1', type: 'user', tenantId: 'tenant-1' } } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireTenantModule('finance')(req, res, next);

    expect(isTenantModuleEnabledMock).toHaveBeenCalledWith('tenant-1', 'finance');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
