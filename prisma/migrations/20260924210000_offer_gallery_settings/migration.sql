-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "badge" TEXT;
ALTER TABLE "Offer" ADD COLUMN "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Offer" ADD COLUMN "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "offersSectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
