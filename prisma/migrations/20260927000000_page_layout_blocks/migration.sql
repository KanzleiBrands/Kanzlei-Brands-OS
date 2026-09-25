-- CreateEnum
CREATE TYPE "DashboardPage" AS ENUM ('OVERVIEW', 'HUB');

-- CreateTable
CREATE TABLE "PageLayoutBlock" (
    "id" TEXT NOT NULL,
    "page" "DashboardPage" NOT NULL,
    "blockKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageLayoutBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageLayoutBlock_page_idx" ON "PageLayoutBlock"("page");

-- CreateIndex
CREATE UNIQUE INDEX "PageLayoutBlock_page_blockKey_key" ON "PageLayoutBlock"("page", "blockKey");
