-- 采购合同关联承包合同，并独立记录采购付款。
ALTER TABLE "contracts" ADD COLUMN "parentContractId" TEXT;

CREATE TABLE "contract_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contract_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "contract_payments_tenantId_contractId_idx" ON "contract_payments"("tenantId", "contractId");
CREATE INDEX "contracts_parentContractId_idx" ON "contracts"("parentContractId");
