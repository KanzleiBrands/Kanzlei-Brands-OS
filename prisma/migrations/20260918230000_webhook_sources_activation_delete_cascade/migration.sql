-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactSource" ADD VALUE 'ELEMENTOR';
ALTER TYPE "ContactSource" ADD VALUE 'TYPEFORM';
ALTER TYPE "ContactSource" ADD VALUE 'FUNNELCOCKPIT';
ALTER TYPE "ContactSource" ADD VALUE 'HEYFLOW';
ALTER TYPE "ContactSource" ADD VALUE 'MEETOVO';
ALTER TYPE "ContactSource" ADD VALUE 'AIDAFORM';
ALTER TYPE "ContactSource" ADD VALUE 'THRIVE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WebhookSource" ADD VALUE 'ELEMENTOR';
ALTER TYPE "WebhookSource" ADD VALUE 'TYPEFORM';
ALTER TYPE "WebhookSource" ADD VALUE 'FUNNELCOCKPIT';
ALTER TYPE "WebhookSource" ADD VALUE 'HEYFLOW';
ALTER TYPE "WebhookSource" ADD VALUE 'MEETOVO';
ALTER TYPE "WebhookSource" ADD VALUE 'AIDAFORM';
ALTER TYPE "WebhookSource" ADD VALUE 'THRIVE';

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_pipelineId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT "WebhookEndpoint_pipelineId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activationToken" TEXT,
ADD COLUMN     "activationTokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_activationToken_key" ON "User"("activationToken");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

