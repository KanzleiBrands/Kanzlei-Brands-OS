-- Internal course assignment moves from department-level to per-employee -
-- a department-wide toggle was too coarse; courses are now assigned to
-- individual agency staff directly.

-- DropForeignKey
ALTER TABLE "CourseDepartmentAssignment" DROP CONSTRAINT "CourseDepartmentAssignment_courseId_fkey";

-- DropTable
DROP TABLE "CourseDepartmentAssignment";

-- CreateTable
CREATE TABLE "CourseUserAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseUserAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseUserAssignment_userId_idx" ON "CourseUserAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseUserAssignment_courseId_userId_key" ON "CourseUserAssignment"("courseId", "userId");

-- AddForeignKey
ALTER TABLE "CourseUserAssignment" ADD CONSTRAINT "CourseUserAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUserAssignment" ADD CONSTRAINT "CourseUserAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
