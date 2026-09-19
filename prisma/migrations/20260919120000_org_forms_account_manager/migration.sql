-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "accountManagerId" TEXT,
ADD COLUMN     "applicantsFormUrl" TEXT,
ADD COLUMN     "leadsFormUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
