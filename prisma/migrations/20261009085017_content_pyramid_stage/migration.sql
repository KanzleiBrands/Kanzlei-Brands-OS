-- CreateEnum
CREATE TYPE "ContentPyramidStage" AS ENUM ('REACH', 'EDUCATION', 'CONVERSION');

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "pyramidStage" "ContentPyramidStage";
