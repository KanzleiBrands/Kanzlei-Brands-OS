-- AlterEnum
ALTER TYPE "SocialMediaType" ADD VALUE 'CAROUSEL';

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "SocialPost" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "impressions" INTEGER;
ALTER TABLE "SocialPost" ADD COLUMN "reach" INTEGER;
ALTER TABLE "SocialPost" ADD COLUMN "likeCount" INTEGER;
ALTER TABLE "SocialPost" ADD COLUMN "commentCount" INTEGER;
ALTER TABLE "SocialPost" ADD COLUMN "shareCount" INTEGER;
ALTER TABLE "SocialPost" ADD COLUMN "clickCount" INTEGER;
ALTER TABLE "SocialPost" ADD COLUMN "insightsSyncedAt" TIMESTAMP(3);
