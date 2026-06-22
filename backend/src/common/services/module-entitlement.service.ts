import { prisma } from '../utils/prisma';

export const TENANT_MODULE_KEYS = ['wms', 'labor', 'finance'] as const;
export type TenantModuleKey = typeof TENANT_MODULE_KEYS[number];

export interface TenantModuleState {
  moduleKey: TenantModuleKey;
  isEnabled: boolean;
  enabledAt: Date;
  disabledAt: Date | null;
  expiresAt: Date | null;
  remark: string | null;
}

export function isTenantModuleKey(value: string): value is TenantModuleKey {
  return (TENANT_MODULE_KEYS as readonly string[]).includes(value);
}

export async function ensureTenantModuleEntitlements(tenantId: string): Promise<TenantModuleState[]> {
  const existing = await prisma.tenantModuleEntitlement.findMany({
    where: { tenantId, moduleKey: { in: [...TENANT_MODULE_KEYS] } },
  });
  const existingKeys = new Set(existing.map(item => item.moduleKey));
  const missingKeys = TENANT_MODULE_KEYS.filter(moduleKey => !existingKeys.has(moduleKey));

  if (missingKeys.length > 0) {
    for (const moduleKey of missingKeys) {
      await prisma.tenantModuleEntitlement.upsert({
        where: { tenantId_moduleKey: { tenantId, moduleKey } },
        update: {},
        create: {
          tenantId,
          moduleKey,
          isEnabled: true,
          enabledAt: new Date(),
          remark: '系统默认开通，保护历史企业功能连续性',
        },
      });
    }
  }

  const all = await prisma.tenantModuleEntitlement.findMany({
    where: { tenantId, moduleKey: { in: [...TENANT_MODULE_KEYS] } },
    orderBy: { moduleKey: 'asc' },
  });

  return TENANT_MODULE_KEYS.map(moduleKey => {
    const row = all.find(item => item.moduleKey === moduleKey);
    return {
      moduleKey,
      isEnabled: row?.isEnabled ?? true,
      enabledAt: row?.enabledAt ?? new Date(),
      disabledAt: row?.disabledAt ?? null,
      expiresAt: row?.expiresAt ?? null,
      remark: row?.remark ?? null,
    };
  });
}

export async function getTenantEnabledModules(tenantId: string): Promise<TenantModuleKey[]> {
  const modules = await ensureTenantModuleEntitlements(tenantId);
  const now = new Date();
  return modules
    .filter(item => item.isEnabled && (!item.expiresAt || item.expiresAt > now))
    .map(item => item.moduleKey);
}

export async function isTenantModuleEnabled(tenantId: string, moduleKey: TenantModuleKey): Promise<boolean> {
  const enabledModules = await getTenantEnabledModules(tenantId);
  return enabledModules.includes(moduleKey);
}

export async function updateTenantModuleEntitlements(
  tenantId: string,
  updates: Array<{ moduleKey: TenantModuleKey; isEnabled: boolean; expiresAt?: Date | null; remark?: string | null }>,
): Promise<TenantModuleState[]> {
  for (const update of updates) {
    await prisma.tenantModuleEntitlement.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: update.moduleKey } },
      update: {
        isEnabled: update.isEnabled,
        enabledAt: update.isEnabled ? new Date() : undefined,
        disabledAt: update.isEnabled ? null : new Date(),
        expiresAt: update.expiresAt ?? null,
        remark: update.remark ?? null,
      },
      create: {
        tenantId,
        moduleKey: update.moduleKey,
        isEnabled: update.isEnabled,
        enabledAt: new Date(),
        disabledAt: update.isEnabled ? null : new Date(),
        expiresAt: update.expiresAt ?? null,
        remark: update.remark ?? null,
      },
    });
  }

  return ensureTenantModuleEntitlements(tenantId);
}
