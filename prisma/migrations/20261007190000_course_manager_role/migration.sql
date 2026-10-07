-- Adds the "Kursmanager" role: a per-employee, Super-Admin-granted
-- permission to manage/build internal courses, scoped to all departments
-- or a specific set.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "courseManagerAllDepartments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "courseManagerDepartments" "AgencyDepartment"[] DEFAULT ARRAY[]::"AgencyDepartment"[],
ADD COLUMN     "isCourseManager" BOOLEAN NOT NULL DEFAULT false;
