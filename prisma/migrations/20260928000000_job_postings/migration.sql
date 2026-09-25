-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aboutUs" TEXT,
    "tasks" TEXT,
    "profile" TEXT,
    "benefitsList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactName" TEXT,
    "contactEmail" TEXT,
    "applicationUrl" TEXT,
    "targetPortals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_pipelineId_key" ON "JobPosting"("pipelineId");

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
