-- 分包合同关联班组，并为合同基础板块提供付款/凭证流程。
ALTER TABLE "sub_contracts" ADD COLUMN "workTeamId" TEXT;

CREATE INDEX "sub_contracts_workTeamId_idx" ON "sub_contracts"("workTeamId");
