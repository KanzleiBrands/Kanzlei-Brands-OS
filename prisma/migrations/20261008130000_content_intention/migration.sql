-- CreateEnum
CREATE TYPE "ContentIntention" AS ENUM ('RECRUITING', 'MANDATSAKQUISE', 'BEIDE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "contentIntention" "ContentIntention";
