-- AlterEnum
ALTER TYPE "SystemEmailType" ADD VALUE 'ABSENCE_REQUEST_SUBMITTED';
ALTER TYPE "SystemEmailType" ADD VALUE 'ABSENCE_REQUEST_DECIDED';

-- DropForeignKey
ALTER TABLE "DepartmentContact" DROP CONSTRAINT "DepartmentContact_contactUserId_fkey";

-- DropTable
DROP TABLE "DepartmentContact";
