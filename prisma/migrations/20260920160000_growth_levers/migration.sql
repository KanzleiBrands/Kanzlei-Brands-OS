-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "activeApplicantChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "activeLeadChannels" TEXT[] DEFAULT ARRAY[]::TEXT[];
