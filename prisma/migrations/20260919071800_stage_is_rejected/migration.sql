-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "isRejected" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing stages literally named "Absage" already act as the
-- rejection bucket in every current template/pipeline - mark them so the
-- Kanban board can hide them and the Ausgeschlossen tab can pick them up
-- without anyone having to re-edit their templates.
UPDATE "Stage" SET "isRejected" = true WHERE lower("name") = 'absage';

UPDATE "StageTemplate"
SET "stages" = (
  SELECT jsonb_agg(
    CASE
      WHEN lower(elem->>'name') = 'absage' THEN elem || '{"isRejected": true}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements("stages") AS elem
);
