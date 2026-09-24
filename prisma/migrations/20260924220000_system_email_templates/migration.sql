-- CreateEnum
CREATE TYPE "SystemEmailType" AS ENUM ('PASSWORD_RESET', 'PORTAL_INVITE', 'NEW_LEAD_NOTIFICATION', 'NEW_APPLICANT_NOTIFICATION');

-- CreateTable
CREATE TABLE "SystemEmailTemplate" (
    "id" TEXT NOT NULL,
    "type" "SystemEmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "footerNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemEmailTemplate_type_key" ON "SystemEmailTemplate"("type");
