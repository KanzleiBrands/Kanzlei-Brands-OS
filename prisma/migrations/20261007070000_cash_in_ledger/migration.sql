-- CreateEnum
CREATE TYPE "CashInLedgerStatus" AS ENUM ('GEPLANT', 'BEZAHLT', 'UEBERFAELLIG');

-- CreateTable
CREATE TABLE "CashInLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "amountNet" DOUBLE PRECISION NOT NULL,
    "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "status" "CashInLedgerStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashInLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashInLedgerEntry_organizationId_invoiceDate_idx" ON "CashInLedgerEntry"("organizationId", "invoiceDate");

-- AddForeignKey
ALTER TABLE "CashInLedgerEntry" ADD CONSTRAINT "CashInLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
