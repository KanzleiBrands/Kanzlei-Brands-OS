-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "airtableRecordId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_airtableRecordId_key" ON "Organization"("airtableRecordId");
