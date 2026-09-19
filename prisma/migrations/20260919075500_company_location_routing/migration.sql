-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "address" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN     "locationRouting" JSONB;

-- CreateTable
CREATE TABLE "AdditionalContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdditionalContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdditionalContact_contactId_idx" ON "AdditionalContact"("contactId");

-- AddForeignKey
ALTER TABLE "AdditionalContact" ADD CONSTRAINT "AdditionalContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

