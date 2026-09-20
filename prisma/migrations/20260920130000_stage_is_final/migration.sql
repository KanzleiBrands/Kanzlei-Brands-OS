-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark the "success" stage on existing pipelines explicitly instead
-- of inferring it from stage order, which broke wherever a non-rejected
-- stage (e.g. "Verloren") sits after the real final stage (e.g. "Gewonnen").
-- Best-effort name match among non-rejected stages, highest order if several
-- match. Pipelines with no matching stage name are left with isFinal=false
-- everywhere - honest gap, better than guessing wrong; the agency can mark
-- the right stage manually via the stage template editor.
WITH candidates AS (
  SELECT DISTINCT ON ("pipelineId") id, "pipelineId"
  FROM "Stage"
  WHERE "isRejected" = false
    AND name ~* '(gewonnen|abgeschlossen|erfolgreich|eingestellt|angenommen|zusage)'
  ORDER BY "pipelineId", "order" DESC
)
UPDATE "Stage" s
SET "isFinal" = true
FROM candidates c
WHERE s.id = c.id;

-- Same for the stored stage templates, so campaigns created from them going
-- forward already have a sensible default final stage.
UPDATE "StageTemplate"
SET "stages" = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'name' = 'Abgeschlossen' THEN elem || '{"isFinal": true}'::jsonb ELSE elem END
  )
  FROM jsonb_array_elements("stages") AS elem
)
WHERE id = 'seed-template-crm';
