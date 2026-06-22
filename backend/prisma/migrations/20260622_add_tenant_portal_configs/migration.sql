-- 企业独立登录页配置：绑定域名后，企业登录不需要企业代码。
CREATE TABLE "tenant_portal_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "companyName" TEXT,
    "loginTitle" TEXT,
    "themeColor" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tenant_portal_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_portal_configs_tenantId_key" ON "tenant_portal_configs"("tenantId");
CREATE UNIQUE INDEX "tenant_portal_configs_domain_key" ON "tenant_portal_configs"("domain");
CREATE INDEX "tenant_portal_configs_domain_idx" ON "tenant_portal_configs"("domain");
