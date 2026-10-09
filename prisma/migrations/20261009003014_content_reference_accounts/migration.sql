-- CreateEnum
CREATE TYPE "ReferenceAccountPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'OTHER');

-- CreateTable
CREATE TABLE "ContentReferenceAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "ReferenceAccountPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "scanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalysis" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentReferenceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReferenceAccount_organizationId_idx" ON "ContentReferenceAccount"("organizationId");

-- AddForeignKey
ALTER TABLE "ContentReferenceAccount" ADD CONSTRAINT "ContentReferenceAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
