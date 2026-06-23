CREATE TABLE "mini_program_phone_bindings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "developerId" TEXT NOT NULL,
    "miniProgramConfigId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mini_program_phone_bindings_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mini_program_phone_bindings_miniProgramConfigId_fkey" FOREIGN KEY ("miniProgramConfigId") REFERENCES "mini_program_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mini_program_phone_bindings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mini_program_phone_bindings_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mini_program_phone_bindings_miniProgramConfigId_phone_key" ON "mini_program_phone_bindings"("miniProgramConfigId", "phone");
CREATE INDEX "mini_program_phone_bindings_developerId_idx" ON "mini_program_phone_bindings"("developerId");
CREATE INDEX "mini_program_phone_bindings_tenantId_idx" ON "mini_program_phone_bindings"("tenantId");
CREATE INDEX "mini_program_phone_bindings_personnelId_idx" ON "mini_program_phone_bindings"("personnelId");
