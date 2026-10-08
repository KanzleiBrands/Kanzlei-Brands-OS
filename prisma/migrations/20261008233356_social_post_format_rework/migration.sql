/*
  Warnings:

  - You are about to drop the column `pipelineId` on the `SocialPost` table. All the data in the column will be lost.
  - You are about to drop the column `utmCampaign` on the `SocialPost` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SocialPostFormat" AS ENUM ('REEL', 'IMAGE_POST', 'CAROUSEL', 'THOUGHT_LEADERSHIP');

-- DropForeignKey
ALTER TABLE "SocialPost" DROP CONSTRAINT "SocialPost_pipelineId_fkey";

-- AlterTable
ALTER TABLE "SocialPost" DROP COLUMN "pipelineId",
DROP COLUMN "utmCampaign",
ADD COLUMN     "format" "SocialPostFormat",
ADD COLUMN     "script" TEXT;
