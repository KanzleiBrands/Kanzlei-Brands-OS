-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "companyWebsite" TEXT,
ADD COLUMN "businessNumber" TEXT,
ADD COLUMN "vatId" TEXT,
ADD COLUMN "foundedYear" INTEGER,
ADD COLUMN "mission" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "managerId" TEXT,
ADD COLUMN "position" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "birthday" TIMESTAMP(3),
ADD COLUMN "hireDate" TIMESTAMP(3),
ADD COLUMN "employmentEndedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "EmployeeDocumentCategory" AS ENUM ('CONTRACT', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "AbsenceAllowanceType" AS ENUM ('LIMITED', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "AbsenceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "EmployeeDocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "description" TEXT,
    "documentDate" TIMESTAMP(3),
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "allowanceType" "AbsenceAllowanceType" NOT NULL DEFAULT 'UNLIMITED',
    "defaultAnnualDays" INTEGER,
    "weeklyCapDays" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "absenceTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDays" INTEGER NOT NULL,

    CONSTRAINT "AbsenceBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "absenceTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "note" TEXT,
    "status" "AbsenceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_userId_idx" ON "EmployeeDocument"("userId");

-- CreateIndex
CREATE INDEX "AbsenceType_order_idx" ON "AbsenceType"("order");

-- CreateIndex
CREATE INDEX "AbsenceBalance_userId_idx" ON "AbsenceBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceBalance_userId_absenceTypeId_year_key" ON "AbsenceBalance"("userId", "absenceTypeId", "year");

-- CreateIndex
CREATE INDEX "AbsenceRequest_userId_idx" ON "AbsenceRequest"("userId");

-- CreateIndex
CREATE INDEX "AbsenceRequest_status_idx" ON "AbsenceRequest"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceBalance" ADD CONSTRAINT "AbsenceBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceBalance" ADD CONSTRAINT "AbsenceBalance_absenceTypeId_fkey" FOREIGN KEY ("absenceTypeId") REFERENCES "AbsenceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_absenceTypeId_fkey" FOREIGN KEY ("absenceTypeId") REFERENCES "AbsenceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Standard-Abwesenheitsarten (analog Tellent HR), damit "Meine Abwesenheiten"
-- nach dem Deploy nicht leer ist - Agentur-Admins können sie danach unter
-- Personal -> Abwesenheitsarten anpassen/ergänzen.
INSERT INTO "AbsenceType" ("id", "name", "icon", "color", "allowanceType", "defaultAnnualDays", "weeklyCapDays", "requiresApproval", "order") VALUES
('cltype0urlaub00000000001', 'Urlaub', 'Sun', 'blue', 'LIMITED', 30, NULL, true, 0),
('cltype0krank000000000002', 'Krank', 'Cross', 'red', 'UNLIMITED', NULL, NULL, false, 1),
('cltype0homeoffice0000003', 'Homeoffice', 'Home', 'orange', 'UNLIMITED', NULL, 2, false, 2),
('cltype0betriebsurlaub004', 'Betriebsurlaub', 'Building2', 'amber', 'UNLIMITED', NULL, NULL, false, 3),
('cltype0unbezahlturlaub05', 'Unbezahlter Urlaub', 'Wallet', 'pink', 'UNLIMITED', NULL, NULL, true, 4);
