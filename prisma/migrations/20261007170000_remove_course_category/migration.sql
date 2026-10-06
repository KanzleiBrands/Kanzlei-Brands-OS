-- Drop the Onboarding/Training category distinction on Course entirely -
-- it added a confusing filter without a meaningful difference in behavior.

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "category";

-- DropEnum
DROP TYPE "CourseCategory";
