-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "firefliesSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "firefliesLastSyncedAt" TIMESTAMP(3),
    "firefliesLastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirefliesTranscript" (
    "id" TEXT NOT NULL,
    "firefliesId" TEXT NOT NULL,
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

    CONSTRAINT "FirefliesTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirefliesTranscript_firefliesId_key" ON "FirefliesTranscript"("firefliesId");

-- CreateIndex
CREATE INDEX "FirefliesTranscript_dateTime_idx" ON "FirefliesTranscript"("dateTime");
