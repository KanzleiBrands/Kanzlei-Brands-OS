-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "cashflowTaxReservePercent" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN "easybillCustomerId" INTEGER;
CREATE UNIQUE INDEX "Organization_easybillCustomerId_key" ON "Organization"("easybillCustomerId");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "hasCashflowAccess" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: CashflowCostEntry - Monats-Aggregat -> Transaktions-Ledger
DROP INDEX IF EXISTS "CashflowCostEntry_organizationId_category_year_month_key";
DROP INDEX IF EXISTS "CashflowCostEntry_organizationId_year_idx";
ALTER TABLE "CashflowCostEntry" DROP COLUMN "year";
ALTER TABLE "CashflowCostEntry" DROP COLUMN "month";
ALTER TABLE "CashflowCostEntry" ADD COLUMN "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "CashflowCostEntry" ADD COLUMN "counterparty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CashflowCostEntry" ADD COLUMN "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 19;
ALTER TABLE "CashflowCostEntry" ADD COLUMN "note" TEXT;
ALTER TABLE "CashflowCostEntry" ALTER COLUMN "transactionDate" DROP DEFAULT;
ALTER TABLE "CashflowCostEntry" ALTER COLUMN "counterparty" DROP DEFAULT;
CREATE INDEX "CashflowCostEntry_organizationId_transactionDate_idx" ON "CashflowCostEntry"("organizationId", "transactionDate");
