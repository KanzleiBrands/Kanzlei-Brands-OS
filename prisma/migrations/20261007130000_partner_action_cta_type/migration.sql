-- CreateEnum
CREATE TYPE "PartnerActionCtaType" AS ENUM ('LINK', 'ACCOUNT_MANAGER_REQUEST');

-- AlterTable
ALTER TABLE "PartnerAction" ADD COLUMN "ctaType" "PartnerActionCtaType" NOT NULL DEFAULT 'LINK';
