-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "location" TEXT,
ADD COLUMN     "rating" SMALLINT;

-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
