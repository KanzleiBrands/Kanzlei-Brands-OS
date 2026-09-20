-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "applicantDataRetentionMonths" INTEGER,
ADD COLUMN     "leadDataRetentionMonths" INTEGER;

-- AlterTable
ALTER TABLE "Pipeline" DROP COLUMN "rejectedDataRetentionMonths";

