-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE', 'LINKEDIN', 'ORGANIC', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClickIdType" AS ENUM ('FBCLID', 'GCLID', 'GBRAID', 'WBRAID', 'MSCLKID', 'LI_FAT_ID');

-- CreateEnum
CREATE TYPE "JourneyEventType" AS ENUM ('LEAD_CREATED', 'QUALI_CALL_BOOKED', 'QUALI_CALL_DONE', 'QUALI_CALL_NO_SHOW', 'SALES_CALL_1_BOOKED', 'SALES_CALL_1_DONE', 'SALES_CALL_1_NO_SHOW', 'SALES_CALL_2_BOOKED', 'SALES_CALL_2_DONE', 'SALES_CALL_2_NO_SHOW', 'UPSELL', 'DEAL_WON', 'DEAL_LOST');

-- AlterTable
ALTER TABLE "CashflowCostEntry" ALTER COLUMN "amountNet" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "externalCampaignId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreative" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalAdId" TEXT,
    "adSetName" TEXT,
    "previewUrl" TEXT,
    "copyHeadline" TEXT,
    "copyBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSpendEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "platform" "AdPlatform" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountSpent" DOUBLE PRECISION NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdSpendEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT,
    "name" TEXT,
    "closeLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "closeContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Touchpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "anonymousVisitorId" TEXT NOT NULL,
    "candidateId" TEXT,
    "platform" "AdPlatform" NOT NULL DEFAULT 'OTHER',
    "campaignId" TEXT,
    "creativeId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "clickIdType" "ClickIdType",
    "clickIdValue" TEXT,
    "landingUrl" TEXT NOT NULL,
    "referrerUrl" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Touchpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "JourneyEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dealValue" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdCampaign_organizationId_idx" ON "AdCampaign"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_organizationId_platform_name_key" ON "AdCampaign"("organizationId", "platform", "name");

-- CreateIndex
CREATE INDEX "AdCreative_campaignId_idx" ON "AdCreative"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreative_campaignId_name_key" ON "AdCreative"("campaignId", "name");

-- CreateIndex
CREATE INDEX "AdSpendEntry_organizationId_date_idx" ON "AdSpendEntry"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdSpendEntry_organizationId_campaignId_platform_date_key" ON "AdSpendEntry"("organizationId", "campaignId", "platform", "date");

-- CreateIndex
CREATE INDEX "CandidateAccount_organizationId_idx" ON "CandidateAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateAccount_organizationId_domain_key" ON "CandidateAccount"("organizationId", "domain");

-- CreateIndex
CREATE INDEX "Candidate_accountId_idx" ON "Candidate"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_accountId_email_key" ON "Candidate"("accountId", "email");

-- CreateIndex
CREATE INDEX "Touchpoint_organizationId_anonymousVisitorId_idx" ON "Touchpoint"("organizationId", "anonymousVisitorId");

-- CreateIndex
CREATE INDEX "Touchpoint_candidateId_idx" ON "Touchpoint"("candidateId");

-- CreateIndex
CREATE INDEX "Touchpoint_campaignId_idx" ON "Touchpoint"("campaignId");

-- CreateIndex
CREATE INDEX "Touchpoint_organizationId_occurredAt_idx" ON "Touchpoint"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_candidateId_occurredAt_idx" ON "JourneyEvent"("candidateId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyEvent_candidateId_type_key" ON "JourneyEvent"("candidateId", "type");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSpendEntry" ADD CONSTRAINT "AdSpendEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSpendEntry" ADD CONSTRAINT "AdSpendEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAccount" ADD CONSTRAINT "CandidateAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CandidateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "AdCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyEvent" ADD CONSTRAINT "JourneyEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
