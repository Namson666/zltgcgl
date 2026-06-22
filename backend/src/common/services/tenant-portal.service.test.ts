import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tenantPortalConfig: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../utils/prisma', () => ({
  prisma: prismaMock,
}));

import {
  getPublicPortalConfigByHost,
  normalizePortalDomain,
  updateTenantPortalConfig,
} from './tenant-portal.service';

describe('tenant-portal.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes portal domains from URL-like input', () => {
    expect(normalizePortalDomain('https://Login.Example.COM/path')).toBe('login.example.com');
    expect(normalizePortalDomain('login.example.com:443')).toBe('login.example.com');
    expect(normalizePortalDomain('')).toBeNull();
  });

  it('returns public brand config without exposing tenant code', async () => {
    prismaMock.tenantPortalConfig.findFirst.mockResolvedValue({
      domain: 'login.example.com',
      logoUrl: '/uploads/logo.png',
      companyName: '测试企业',
      loginTitle: '测试企业登录',
      themeColor: '#123456',
      tenant: {
        id: 'tenant-1',
        name: '测试企业默认名',
        code: 'SECRET_CODE',
      },
    });

    const result = await getPublicPortalConfigByHost('https://login.example.com/login');

    expect(prismaMock.tenantPortalConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          domain: 'login.example.com',
          isEnabled: true,
        }),
      }),
    );
    expect(result).toEqual({
      isEnabled: true,
      domain: 'login.example.com',
      logoUrl: '/uploads/logo.png',
      companyName: '测试企业',
      loginTitle: '测试企业登录',
      themeColor: '#123456',
    });
    expect(JSON.stringify(result)).not.toContain('SECRET_CODE');
  });

  it('rejects enabling portal login without a bound domain', async () => {
    await expect(updateTenantPortalConfig('tenant-1', { isEnabled: true, domain: '' })).rejects.toMatchObject({
      status: 400,
      code: 'MISSING_DOMAIN',
    });
    expect(prismaMock.tenantPortalConfig.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid theme color', async () => {
    await expect(updateTenantPortalConfig('tenant-1', {
      isEnabled: false,
      domain: 'login.example.com',
      themeColor: 'blue',
    })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_THEME_COLOR',
    });
    expect(prismaMock.tenantPortalConfig.upsert).not.toHaveBeenCalled();
  });
});
