-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "contentWebsiteUrl" TEXT;

-- CreateTable
CREATE TABLE "ContentReferenceDoc" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReferenceDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReferenceDoc_organizationId_idx" ON "ContentReferenceDoc"("organizationId");

-- AddForeignKey
ALTER TABLE "ContentReferenceDoc" ADD CONSTRAINT "ContentReferenceDoc_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
