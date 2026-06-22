-- 企业模块开通记录：合同管理为默认基础功能，不进入本表。
CREATE TABLE "tenant_module_entitlements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" DATETIME,
    "expiresAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tenant_module_entitlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_module_entitlements_tenantId_moduleKey_key" ON "tenant_module_entitlements"("tenantId", "moduleKey");
CREATE INDEX "tenant_module_entitlements_tenantId_idx" ON "tenant_module_entitlements"("tenantId");
