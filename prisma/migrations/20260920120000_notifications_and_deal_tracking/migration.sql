-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "dealVolumeEur" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "defaultForKind" "PipelineKind";

-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN     "notifyOnNewContact" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOnNewContact" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organizationId_defaultForKind_key" ON "MessageTemplate"("organizationId", "defaultForKind");

