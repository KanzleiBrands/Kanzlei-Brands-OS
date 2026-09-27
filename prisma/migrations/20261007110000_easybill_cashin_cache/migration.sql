-- CreateTable
CREATE TABLE "EasybillCashInCache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "easybillDocumentId" INTEGER NOT NULL,
    "isForecast" BOOLEAN NOT NULL DEFAULT false,
    "customerId" INTEGER,
    "customerLabel" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "amountNet" DOUBLE PRECISION NOT NULL,
    "amountGross" DOUBLE PRECISION NOT NULL,
    "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "number" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EasybillCashInCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EasybillCashInCache_organizationId_invoiceDate_idx" ON "EasybillCashInCache"("organizationId", "invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "EasybillCashInCache_organizationId_easybillDocumentId_isFor_key" ON "EasybillCashInCache"("organizationId", "easybillDocumentId", "isForecast", "invoiceDate");

-- AddForeignKey
ALTER TABLE "EasybillCashInCache" ADD CONSTRAINT "EasybillCashInCache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
