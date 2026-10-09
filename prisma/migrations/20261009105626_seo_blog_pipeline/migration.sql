-- CreateEnum
CREATE TYPE "SeoContentGapStatus" AS ENUM ('NEW', 'IDEA_CREATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('IDEA', 'IN_PRODUCTION', 'REVIEW', 'CHANGES_REQUESTED', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoBacklinkStatus" AS ENUM ('GEPLANT', 'ANGEFRAGT', 'LIVE', 'ABGELEHNT');

-- CreateTable
CREATE TABLE "GoogleSearchConsoleConnection" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteUrl" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSearchConsoleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContentGap" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "avgPosition" DOUBLE PRECISION NOT NULL,
    "status" "SeoContentGapStatus" NOT NULL DEFAULT 'NEW',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContentGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'IDEA',
    "title" TEXT,
    "topic" TEXT,
    "ideaSourceLabel" TEXT,
    "slug" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "targetKeyword" TEXT,
    "content" TEXT,
    "featuredImageUrl" TEXT,
    "authorUserId" TEXT,
    "reviewFeedback" TEXT,
    "publishError" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBacklink" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT,
    "status" "SeoBacklinkStatus" NOT NULL DEFAULT 'GEPLANT',
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoBacklink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoContentGap_query_key" ON "SeoContentGap"("query");

-- CreateIndex
CREATE INDEX "SeoContentGap_status_idx" ON "SeoContentGap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_scheduledAt_idx" ON "BlogPost"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
