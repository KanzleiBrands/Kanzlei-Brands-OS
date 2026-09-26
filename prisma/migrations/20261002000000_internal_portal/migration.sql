-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENCY_STAFF';

-- CreateEnum
CREATE TYPE "AgencyDepartment" AS ENUM ('SALES', 'BACKOFFICE', 'FULFILLMENT', 'MARKETING', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "CourseAudience" AS ENUM ('CLIENT', 'INTERNAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
ALTER TYPE "DashboardPage" ADD VALUE 'SALES_HUB';
ALTER TYPE "DashboardPage" ADD VALUE 'BACKOFFICE_HUB';
ALTER TYPE "DashboardPage" ADD VALUE 'FULFILLMENT_HUB';
ALTER TYPE "DashboardPage" ADD VALUE 'MARKETING_HUB';
ALTER TYPE "DashboardPage" ADD VALUE 'EXECUTIVE_HUB';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "department" "AgencyDepartment";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "audience" "CourseAudience" NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE "DepartmentContact" (
    "department" "AgencyDepartment" NOT NULL,
    "contactUserId" TEXT,

    CONSTRAINT "DepartmentContact_pkey" PRIMARY KEY ("department")
);

-- CreateTable
CREATE TABLE "DepartmentResourceLink" (
    "id" TEXT NOT NULL,
    "department" "AgencyDepartment" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseDepartmentAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "department" "AgencyDepartment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseDepartmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentResourceLink_department_idx" ON "DepartmentResourceLink"("department");

-- CreateIndex
CREATE UNIQUE INDEX "CourseDepartmentAssignment_courseId_department_key" ON "CourseDepartmentAssignment"("courseId", "department");

-- CreateIndex
CREATE INDEX "CourseDepartmentAssignment_department_idx" ON "CourseDepartmentAssignment"("department");

-- AddForeignKey
ALTER TABLE "DepartmentContact" ADD CONSTRAINT "DepartmentContact_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDepartmentAssignment" ADD CONSTRAINT "CourseDepartmentAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
