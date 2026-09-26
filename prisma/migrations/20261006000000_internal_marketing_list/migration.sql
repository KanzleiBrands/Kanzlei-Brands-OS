-- CreateEnum
CREATE TYPE "MarketingSubscriberStatus" AS ENUM ('ACTIVE', 'SUPPRESSED');

-- CreateTable
CREATE TABLE "MarketingTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" "MarketingSubscriberStatus" NOT NULL DEFAULT 'ACTIVE',
    "suppressedAt" TIMESTAMP(3),
    "suppressedReason" TEXT,
    "closeLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSubscriberTag" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSubscriberTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingListWebhook" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingListWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFunnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "triggerTagId" TEXT,
    "senderAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingFunnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFunnelStep" (
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

    CONSTRAINT "MarketingFunnelStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEnrollment" (
    "id" TEXT NOT NULL,
    "status" "FunnelEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "funnelId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFunnelSend" (
    "id" TEXT NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarketingFunnelSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingTag_organizationId_idx" ON "MarketingTag"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingTag_organizationId_name_key" ON "MarketingTag"("organizationId", "name");

-- CreateIndex
CREATE INDEX "MarketingSubscriber_organizationId_idx" ON "MarketingSubscriber"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscriber_organizationId_email_key" ON "MarketingSubscriber"("organizationId", "email");

-- CreateIndex
CREATE INDEX "MarketingSubscriberTag_tagId_idx" ON "MarketingSubscriberTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscriberTag_subscriberId_tagId_key" ON "MarketingSubscriberTag"("subscriberId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingListWebhook_token_key" ON "MarketingListWebhook"("token");

-- CreateIndex
CREATE INDEX "MarketingListWebhook_organizationId_idx" ON "MarketingListWebhook"("organizationId");

-- CreateIndex
CREATE INDEX "MarketingFunnel_organizationId_idx" ON "MarketingFunnel"("organizationId");

-- CreateIndex
CREATE INDEX "MarketingFunnel_triggerTagId_idx" ON "MarketingFunnel"("triggerTagId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingFunnelStep_funnelId_order_key" ON "MarketingFunnelStep"("funnelId", "order");

-- CreateIndex
CREATE INDEX "MarketingEnrollment_funnelId_idx" ON "MarketingEnrollment"("funnelId");

-- CreateIndex
CREATE INDEX "MarketingEnrollment_nextSendAt_idx" ON "MarketingEnrollment"("nextSendAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingEnrollment_funnelId_subscriberId_key" ON "MarketingEnrollment"("funnelId", "subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingFunnelSend_trackingToken_key" ON "MarketingFunnelSend"("trackingToken");

-- CreateIndex
CREATE INDEX "MarketingFunnelSend_stepId_idx" ON "MarketingFunnelSend"("stepId");

-- CreateIndex
CREATE INDEX "MarketingFunnelSend_enrollmentId_idx" ON "MarketingFunnelSend"("enrollmentId");

-- AddForeignKey
ALTER TABLE "MarketingTag" ADD CONSTRAINT "MarketingTag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSubscriber" ADD CONSTRAINT "MarketingSubscriber_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSubscriberTag" ADD CONSTRAINT "MarketingSubscriberTag_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "MarketingSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSubscriberTag" ADD CONSTRAINT "MarketingSubscriberTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "MarketingTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingListWebhook" ADD CONSTRAINT "MarketingListWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingListWebhook" ADD CONSTRAINT "MarketingListWebhook_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "MarketingTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFunnel" ADD CONSTRAINT "MarketingFunnel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFunnel" ADD CONSTRAINT "MarketingFunnel_triggerTagId_fkey" FOREIGN KEY ("triggerTagId") REFERENCES "MarketingTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFunnel" ADD CONSTRAINT "MarketingFunnel_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFunnelStep" ADD CONSTRAINT "MarketingFunnelStep_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEnrollment" ADD CONSTRAINT "MarketingEnrollment_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEnrollment" ADD CONSTRAINT "MarketingEnrollment_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "MarketingSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFunnelSend" ADD CONSTRAINT "MarketingFunnelSend_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "MarketingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFunnelSend" ADD CONSTRAINT "MarketingFunnelSend_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "MarketingFunnelStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
