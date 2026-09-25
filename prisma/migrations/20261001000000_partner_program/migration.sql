-- CreateEnum
CREATE TYPE "PartnerTransactionKind" AS ENUM ('EARNED', 'REDEEMED', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "PartnerAction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Jetzt starten',
    "ctaUrl" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerReward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Prämien-Punkte einlösen',
    "pointsCost" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPointsTransaction" (
    "id" TEXT NOT NULL,
    "kind" "PartnerTransactionKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionId" TEXT,
    "rewardId" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerAction_order_idx" ON "PartnerAction"("order");

-- CreateIndex
CREATE INDEX "PartnerReward_order_idx" ON "PartnerReward"("order");

-- CreateIndex
CREATE INDEX "PartnerPointsTransaction_organizationId_idx" ON "PartnerPointsTransaction"("organizationId");

-- AddForeignKey
ALTER TABLE "PartnerPointsTransaction" ADD CONSTRAINT "PartnerPointsTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPointsTransaction" ADD CONSTRAINT "PartnerPointsTransaction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "PartnerAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPointsTransaction" ADD CONSTRAINT "PartnerPointsTransaction_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "PartnerReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPointsTransaction" ADD CONSTRAINT "PartnerPointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
