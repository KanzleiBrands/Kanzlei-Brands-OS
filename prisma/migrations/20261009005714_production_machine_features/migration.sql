-- CreateEnum
CREATE TYPE "ContentSnippetCategory" AS ENUM ('SIGNATURE', 'CTA', 'HASHTAGS', 'OTHER');

-- AlterEnum
ALTER TYPE "SystemEmailType" ADD VALUE 'SOCIAL_APPROVAL_REMINDER';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "socialApprovalReminderEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "reviewReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MediaLibraryItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSnippet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "ContentSnippetCategory" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaLibraryItem_organizationId_idx" ON "MediaLibraryItem"("organizationId");

-- CreateIndex
CREATE INDEX "ContentSnippet_organizationId_idx" ON "ContentSnippet"("organizationId");

-- AddForeignKey
ALTER TABLE "MediaLibraryItem" ADD CONSTRAINT "MediaLibraryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSnippet" ADD CONSTRAINT "ContentSnippet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
