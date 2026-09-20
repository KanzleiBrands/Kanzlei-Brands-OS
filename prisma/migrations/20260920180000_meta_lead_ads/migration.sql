
-- CreateTable
CREATE TABLE "MetaLeadFormConnection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "formId" TEXT NOT NULL,
    "formName" TEXT,
    "pageAccessTokenEnc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "organizationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaLeadFormConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaLeadDelivery" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "contactId" TEXT,
    "rawPayload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaLeadDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaLeadFormConnection_organizationId_idx" ON "MetaLeadFormConnection"("organizationId");

-- CreateIndex
CREATE INDEX "MetaLeadFormConnection_pipelineId_idx" ON "MetaLeadFormConnection"("pipelineId");

-- CreateIndex
CREATE INDEX "MetaLeadFormConnection_pageId_idx" ON "MetaLeadFormConnection"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLeadFormConnection_pipelineId_formId_key" ON "MetaLeadFormConnection"("pipelineId", "formId");

-- CreateIndex
CREATE INDEX "MetaLeadDelivery_connectionId_idx" ON "MetaLeadDelivery"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLeadDelivery_connectionId_leadgenId_key" ON "MetaLeadDelivery"("connectionId", "leadgenId");

-- AddForeignKey
ALTER TABLE "MetaLeadFormConnection" ADD CONSTRAINT "MetaLeadFormConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLeadFormConnection" ADD CONSTRAINT "MetaLeadFormConnection_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLeadFormConnection" ADD CONSTRAINT "MetaLeadFormConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLeadDelivery" ADD CONSTRAINT "MetaLeadDelivery_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaLeadFormConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLeadDelivery" ADD CONSTRAINT "MetaLeadDelivery_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

