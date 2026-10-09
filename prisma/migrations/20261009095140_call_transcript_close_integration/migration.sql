/*
  Warnings:

  - You are about to drop the `FirefliesTranscript` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CallTranscriptSource" AS ENUM ('FIREFLIES', 'CLOSE');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "closeCallsLastSyncError" TEXT,
ADD COLUMN     "closeCallsLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "closeCallsSyncEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "ideaSourceLabel" TEXT;

-- DropTable
DROP TABLE "FirefliesTranscript";

-- CreateTable
CREATE TABLE "CallTranscript" (
    "id" TEXT NOT NULL,
    "source" "CallTranscriptSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" DOUBLE PRECISION,
    "organizerEmail" TEXT,
    "participants" TEXT[],
    "meetingUrl" TEXT,
    "summaryOverview" TEXT,
    "transcriptText" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallTranscript_dateTime_idx" ON "CallTranscript"("dateTime");

-- CreateIndex
CREATE UNIQUE INDEX "CallTranscript_source_externalId_key" ON "CallTranscript"("source", "externalId");
