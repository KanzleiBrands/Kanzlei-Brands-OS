-- Merge the standalone "Angebote" (Offer) feature into Partnerprogramm's
-- PartnerReward, since an Offer is conceptually the same as a Prämie that
-- can either be requested for free or redeemed with points - keeping both
-- meant maintaining everything twice.

-- AlterEnum
ALTER TYPE "PartnerTransactionKind" ADD VALUE 'REQUESTED';

-- DropForeignKey
ALTER TABLE "OfferInterest" DROP CONSTRAINT "OfferInterest_offerId_fkey";

-- DropForeignKey
ALTER TABLE "OfferInterest" DROP CONSTRAINT "OfferInterest_userId_fkey";

-- AlterTable
ALTER TABLE "PartnerReward" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "ctaType" "PartnerActionCtaType" NOT NULL DEFAULT 'ACCOUNT_MANAGER_REQUEST',
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "productTag" TEXT,
ALTER COLUMN "pointsCost" DROP NOT NULL;

-- DataMigration: carry every existing Offer row over into PartnerReward as
-- a free-to-request reward (pointsCost = null). "active" preserves the
-- Offer's *effective* current client-facing visibility, which depended on
-- both Offer.active AND the global PlatformSettings.offersSectionEnabled
-- kill-switch (both are being removed) - not just Offer.active alone.
INSERT INTO "PartnerReward" (
  id, title, description, "imageUrl", "ctaLabel", "ctaType", "ctaUrl",
  "pointsCost", "order", active, badge, highlights, "galleryUrls", "productTag",
  "createdAt", "updatedAt"
)
SELECT
  o.id,
  o.title,
  o.description,
  o."imageUrl",
  o."ctaLabel",
  o."ctaType"::text::"PartnerActionCtaType",
  o."ctaUrl",
  NULL,
  COALESCE((SELECT MAX("order") FROM "PartnerReward"), 0) + ROW_NUMBER() OVER (ORDER BY o."createdAt"),
  o.active AND COALESCE((SELECT "offersSectionEnabled" FROM "PlatformSettings" WHERE id = 'default'), false),
  o.badge,
  o.highlights,
  o."galleryUrls",
  o."productTag",
  o."createdAt",
  o."updatedAt"
FROM "Offer" o;

-- DropTable
DROP TABLE "Offer";

-- DropTable
DROP TABLE "OfferInterest";

-- DropTable
DROP TABLE "PlatformSettings";

-- DropEnum
DROP TYPE "OfferCtaType";
