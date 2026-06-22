import { prisma } from '../utils/prisma';

export interface TenantPortalInput {
  domain?: string | null;
  logoUrl?: string | null;
  companyName?: string | null;
  loginTitle?: string | null;
  themeColor?: string | null;
  isEnabled?: boolean;
}

export interface PublicTenantPortalConfig {
  isEnabled: boolean;
  domain: string;
  logoUrl: string | null;
  companyName: string;
  loginTitle: string;
  themeColor: string | null;
}

export function normalizePortalDomain(value?: string | null): string | null {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;

  const withoutProtocol = raw.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0];
  const withoutPort = withoutPath.split(':')[0];
  const normalized = withoutPort.replace(/\.$/, '');
  return normalized || null;
}

function normalizeOptionalString(value?: string | null): string | null {
  const trimmed = (value || '').trim();
  return trimmed || null;
}

function normalizeThemeColor(value?: string | null): string | null {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) return null;
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
}

export async function getTenantPortalConfig(tenantId: string) {
  const existing = await prisma.tenantPortalConfig.findUnique({
    where: { tenantId },
  });

  if (existing) return existing;

  return prisma.tenantPortalConfig.create({
    data: {
      tenantId,
      isEnabled: false,
    },
  });
}

export async function updateTenantPortalConfig(tenantId: string, input: TenantPortalInput) {
  const domain = normalizePortalDomain(input.domain);
  const logoUrl = normalizeOptionalString(input.logoUrl);
  const companyName = normalizeOptionalString(input.companyName);
  const loginTitle = normalizeOptionalString(input.loginTitle);
  const themeColor = normalizeThemeColor(input.themeColor);
  const isEnabled = Boolean(input.isEnabled);

  if (isEnabled && !domain) {
    throw { status: 400, code: 'MISSING_DOMAIN', message: '启用独立登录页前必须配置域名' };
  }

  if (input.themeColor && !themeColor) {
    throw { status: 400, code: 'INVALID_THEME_COLOR', message: '主题色必须是 #RRGGBB 格式' };
  }

  if (domain) {
    const conflict = await prisma.tenantPortalConfig.findFirst({
      where: {
        domain,
        tenantId: { not: tenantId },
      },
    });
    if (conflict) {
      throw { status: 409, code: 'DOMAIN_CONFLICT', message: '该域名已绑定其他企业' };
    }
  }

  return prisma.tenantPortalConfig.upsert({
    where: { tenantId },
    update: {
      domain,
      logoUrl,
      companyName,
      loginTitle,
      themeColor,
      isEnabled,
    },
    create: {
      tenantId,
      domain,
      logoUrl,
      companyName,
      loginTitle,
      themeColor,
      isEnabled,
    },
  });
}

export async function findEnabledPortalByHost(hostname?: string | null) {
  const domain = normalizePortalDomain(hostname);
  if (!domain) return null;

  return prisma.tenantPortalConfig.findFirst({
    where: {
      domain,
      isEnabled: true,
      tenant: {
        isActive: true,
        deletedAt: null,
      },
    },
    include: {
      tenant: true,
    },
  });
}

export async function getPublicPortalConfigByHost(hostname?: string | null): Promise<PublicTenantPortalConfig | null> {
  const portal = await findEnabledPortalByHost(hostname);
  if (!portal) return null;

  return {
    isEnabled: true,
    domain: portal.domain!,
    logoUrl: portal.logoUrl,
    companyName: portal.companyName || portal.tenant.name,
    loginTitle: portal.loginTitle || `${portal.companyName || portal.tenant.name} 登录`,
    themeColor: portal.themeColor,
  };
}
