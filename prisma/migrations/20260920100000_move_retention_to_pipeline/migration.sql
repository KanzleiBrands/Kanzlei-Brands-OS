-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "rejectedDataRetentionMonths";

-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN     "rejectedDataRetentionMonths" INTEGER;

