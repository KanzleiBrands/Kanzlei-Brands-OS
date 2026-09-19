-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('NEW_LEAD', 'UNPROCESSED_24H', 'UNPROCESSED_72H');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "pipelineId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_pipelineId_idx" ON "AutomationRule"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_pipelineId_trigger_key" ON "AutomationRule"("pipelineId", "trigger");

-- CreateIndex
CREATE INDEX "AutomationLog_contactId_idx" ON "AutomationLog"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationLog_ruleId_contactId_key" ON "AutomationLog"("ruleId", "contactId");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

