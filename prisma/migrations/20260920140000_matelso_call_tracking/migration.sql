-- AlterEnum
ALTER TYPE "ContactSource" ADD VALUE 'MATELSO';

-- AlterEnum
ALTER TYPE "WebhookSource" ADD VALUE 'MATELSO';

-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN     "skippedReason" TEXT;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN     "minCallDurationSeconds" INTEGER;
