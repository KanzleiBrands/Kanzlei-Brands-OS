-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "dataForSeoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataForSeoLastSyncError" TEXT,
ADD COLUMN     "dataForSeoLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "dataForSeoTargetDomain" TEXT;

-- AlterTable
ALTER TABLE "SeoContentGap" ADD COLUMN     "cpc" DOUBLE PRECISION,
ADD COLUMN     "searchVolume" INTEGER;

-- CreateTable
CREATE TABLE "SeoCompetitorDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoCompetitorDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoCompetitorKeywordGap" (
    "id" TEXT NOT NULL,
    "competitorDomainId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "competitorPosition" INTEGER,
    "ourPosition" INTEGER,
    "status" "SeoContentGapStatus" NOT NULL DEFAULT 'NEW',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoCompetitorKeywordGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBacklinkProfile" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "domain" TEXT,
    "rank" INTEGER,
    "backlinks" INTEGER,
    "referringDomains" INTEGER,
    "referringDomainsNofollow" INTEGER,
    "brokenBacklinks" INTEGER,
    "spamScore" INTEGER,
    "fetchedAt" TIMESTAMP(3),
    "fetchError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoBacklinkProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoCompetitorDomain_domain_key" ON "SeoCompetitorDomain"("domain");

-- CreateIndex
CREATE INDEX "SeoCompetitorKeywordGap_status_idx" ON "SeoCompetitorKeywordGap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SeoCompetitorKeywordGap_competitorDomainId_keyword_key" ON "SeoCompetitorKeywordGap"("competitorDomainId", "keyword");

-- AddForeignKey
ALTER TABLE "SeoCompetitorKeywordGap" ADD CONSTRAINT "SeoCompetitorKeywordGap_competitorDomainId_fkey" FOREIGN KEY ("competitorDomainId") REFERENCES "SeoCompetitorDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
