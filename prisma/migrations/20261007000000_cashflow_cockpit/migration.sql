-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "profitGoalAnnual" INTEGER;

-- CreateEnum
CREATE TYPE "CashflowCostCategory" AS ENUM ('PERSONNEL', 'MARKETING', 'INFRASTRUCTURE', 'VARIABLE', 'AD_BUDGET');

-- CreateTable
CREATE TABLE "CashflowCostEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "CashflowCostCategory" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amountNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashflowCostEntry_organizationId_year_idx" ON "CashflowCostEntry"("organizationId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "CashflowCostEntry_organizationId_category_year_month_key" ON "CashflowCostEntry"("organizationId", "category", "year", "month");

-- AddForeignKey
ALTER TABLE "CashflowCostEntry" ADD CONSTRAINT "CashflowCostEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
