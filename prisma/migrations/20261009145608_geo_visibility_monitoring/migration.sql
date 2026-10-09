-- CreateEnum
CREATE TYPE "GeoAiProvider" AS ENUM ('CHATGPT', 'CLAUDE', 'GEMINI', 'PERPLEXITY');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "geoTargetBrandName" TEXT;

-- CreateTable
CREATE TABLE "GeoMonitoredPrompt" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "label" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoMonitoredPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoVisibilityCheck" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "provider" "GeoAiProvider" NOT NULL,
    "mentioned" BOOLEAN NOT NULL DEFAULT false,
    "cited" BOOLEAN NOT NULL DEFAULT false,
    "citedUrl" TEXT,
    "modelName" TEXT,
    "responseExcerpt" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoVisibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoVisibilityCheck_promptId_provider_key" ON "GeoVisibilityCheck"("promptId", "provider");

-- AddForeignKey
ALTER TABLE "GeoVisibilityCheck" ADD CONSTRAINT "GeoVisibilityCheck_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "GeoMonitoredPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
