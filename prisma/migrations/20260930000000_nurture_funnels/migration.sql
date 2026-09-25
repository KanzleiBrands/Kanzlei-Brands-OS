-- CreateEnum
CREATE TYPE "FunnelTriggerType" AS ENUM ('MANUAL', 'ON_NEW_LEAD', 'ON_INACTIVITY');

-- CreateEnum
CREATE TYPE "FunnelEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STOPPED');

-- CreateTable
CREATE TABLE "NurtureFunnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" "FunnelTriggerType" NOT NULL DEFAULT 'MANUAL',
    "inactivityDays" INTEGER,
    "pipelineId" TEXT NOT NULL,
    "senderAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurtureFunnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelStep" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "bodyText" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "funnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEnrollment" (
    "id" TEXT NOT NULL,
    "status" "FunnelEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "funnelId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelStepSend" (
    "id" TEXT NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FunnelStepSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NurtureFunnel_pipelineId_idx" ON "NurtureFunnel"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelStep_funnelId_order_key" ON "FunnelStep"("funnelId", "order");

-- CreateIndex
CREATE INDEX "FunnelEnrollment_funnelId_idx" ON "FunnelEnrollment"("funnelId");

-- CreateIndex
CREATE INDEX "FunnelEnrollment_nextSendAt_idx" ON "FunnelEnrollment"("nextSendAt");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelEnrollment_funnelId_contactId_key" ON "FunnelEnrollment"("funnelId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelStepSend_trackingToken_key" ON "FunnelStepSend"("trackingToken");

-- CreateIndex
CREATE INDEX "FunnelStepSend_stepId_idx" ON "FunnelStepSend"("stepId");

-- CreateIndex
CREATE INDEX "FunnelStepSend_enrollmentId_idx" ON "FunnelStepSend"("enrollmentId");

-- AddForeignKey
ALTER TABLE "NurtureFunnel" ADD CONSTRAINT "NurtureFunnel_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureFunnel" ADD CONSTRAINT "NurtureFunnel_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStep" ADD CONSTRAINT "FunnelStep_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "NurtureFunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEnrollment" ADD CONSTRAINT "FunnelEnrollment_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "NurtureFunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEnrollment" ADD CONSTRAINT "FunnelEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStepSend" ADD CONSTRAINT "FunnelStepSend_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "FunnelEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStepSend" ADD CONSTRAINT "FunnelStepSend_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "FunnelStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
