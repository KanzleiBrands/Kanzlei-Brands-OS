-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "cvUrl" TEXT;

-- CreateTable
CREATE TABLE "StageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageTemplate_pkey" PRIMARY KEY ("id")
);

