-- Add a Module grouping level between Course and Lesson (Kurse -> Module ->
-- Lektionen), plus richer Lesson content fields (description, thumbnail,
-- pdfUrl, notionUrl) and a Course thumbnail.
--
-- Existing Lessons are reassigned to a new "Modul 1" per Course so no
-- existing lesson/progress data is lost.

-- 1. Course thumbnail
ALTER TABLE "Course" ADD COLUMN "thumbnailUrl" TEXT;

-- 2. Module table
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "thumbnailUrl" TEXT,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. New Lesson columns (moduleId starts nullable so existing rows can be backfilled)
ALTER TABLE "Lesson" ADD COLUMN "description" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "notionUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "moduleId" TEXT;

-- 4. Data migration: one default Module per Course that already has Lessons
INSERT INTO "Module" ("id", "title", "order", "courseId")
SELECT gen_random_uuid()::text, 'Modul 1', 0, "Course"."id"
FROM "Course"
WHERE EXISTS (SELECT 1 FROM "Lesson" WHERE "Lesson"."courseId" = "Course"."id");

UPDATE "Lesson"
SET "moduleId" = "Module"."id"
FROM "Module"
WHERE "Module"."courseId" = "Lesson"."courseId";

-- 5. Drop the old Course relation now that every Lesson has a moduleId
ALTER TABLE "Lesson" ALTER COLUMN "moduleId" SET NOT NULL;

ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_courseId_fkey";
DROP INDEX IF EXISTS "Lesson_courseId_idx";
ALTER TABLE "Lesson" DROP COLUMN "courseId";

ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");
