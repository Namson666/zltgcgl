ALTER TABLE "personnel" ADD COLUMN "facePhotoUrl" TEXT;
ALTER TABLE "personnel" ADD COLUMN "faceProvider" TEXT;
ALTER TABLE "personnel" ADD COLUMN "faceStatus" TEXT NOT NULL DEFAULT 'not_enrolled';
ALTER TABLE "personnel" ADD COLUMN "faceUpdatedAt" DATETIME;

CREATE TABLE "mini_program_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "developerId" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appSecret" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mini_program_configs_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mini_program_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mini_program_configs_appId_key" ON "mini_program_configs"("appId");
CREATE INDEX "mini_program_configs_tenantId_idx" ON "mini_program_configs"("tenantId");

CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "checkInsPerDay" INTEGER NOT NULL DEFAULT 1,
    "faceProvider" TEXT NOT NULL DEFAULT 'stub',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "attendance_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "attendance_settings_tenantId_key" ON "attendance_settings"("tenantId");

CREATE TABLE "mobile_check_in_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "appId" TEXT,
    "phone" TEXT NOT NULL,
    "checkDate" DATETIME NOT NULL,
    "sequenceNo" INTEGER NOT NULL DEFAULT 1,
    "latitude" REAL,
    "longitude" REAL,
    "address" TEXT,
    "province" TEXT,
    "city" TEXT,
    "county" TEXT,
    "countyCode" TEXT,
    "photoUrl" TEXT,
    "faceProvider" TEXT,
    "faceStatus" TEXT NOT NULL DEFAULT 'provider_error',
    "status" TEXT NOT NULL DEFAULT 'normal',
    "abnormalReason" TEXT,
    "resolvedAt" DATETIME,
    "resolveReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mobile_check_in_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mobile_check_in_records_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mobile_check_in_records_personnelId_checkDate_sequenceNo_key" ON "mobile_check_in_records"("personnelId", "checkDate", "sequenceNo");
CREATE INDEX "mobile_check_in_records_tenantId_checkDate_idx" ON "mobile_check_in_records"("tenantId", "checkDate");
CREATE INDEX "mobile_check_in_records_tenantId_status_idx" ON "mobile_check_in_records"("tenantId", "status");

CREATE TABLE "trusted_check_in_locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "county" TEXT NOT NULL,
    "countyCode" TEXT,
    "remark" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "trusted_check_in_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trusted_check_in_locations_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trusted_check_in_locations_personnelId_county_key" ON "trusted_check_in_locations"("personnelId", "county");
CREATE INDEX "trusted_check_in_locations_tenantId_personnelId_idx" ON "trusted_check_in_locations"("tenantId", "personnelId");
