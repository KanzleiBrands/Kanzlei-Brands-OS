-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "productTag" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "backofficeContactId" TEXT,
ADD COLUMN     "bookedProductTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "driveFolderUrl" TEXT,
ADD COLUMN     "landingPageUrl" TEXT,
ADD COLUMN     "linkedInAdLibraryUrl" TEXT,
ADD COLUMN     "metaAdLibraryUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendlyUrl" TEXT,
ADD COLUMN     "phone" TEXT;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_backofficeContactId_fkey" FOREIGN KEY ("backofficeContactId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
