-- AlterTable
ALTER TABLE "JobPosting"
  ADD COLUMN "employerName" TEXT,
  ADD COLUMN "employerLogoUrl" TEXT,
  ADD COLUMN "employerWebsite" TEXT,
  ADD COLUMN "street" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT DEFAULT 'DE',
  ADD COLUMN "employmentType" TEXT DEFAULT 'FULL_TIME',
  ADD COLUMN "validThrough" TIMESTAMP(3),
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3);
