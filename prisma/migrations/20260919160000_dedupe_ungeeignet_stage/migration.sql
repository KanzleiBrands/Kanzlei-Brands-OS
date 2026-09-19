-- Data fix: some pipelines ended up with two separate "Ungeeignet" stages
-- (one from the pipeline's original stage template, one added by the
-- 20260919100000_leads_ungeeignet_stage backfill for pipelines it thought
-- lacked a rejected stage). Both are now isRejected=true after
-- 20260919150000_fix_ungeeignet_isrejected, but that leaves two entries in
-- every stage picker. Merge them into a single stage per pipeline: keep the
-- one that was already isRejected, move any of its contacts over, drop the
-- rest.

WITH ranked AS (
  SELECT id, "pipelineId",
         ROW_NUMBER() OVER (
           PARTITION BY "pipelineId"
           ORDER BY "isRejected" DESC, "order" ASC, id ASC
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY "pipelineId"
           ORDER BY "isRejected" DESC, "order" ASC, id ASC
         ) AS keeper_id
  FROM "Stage"
  WHERE name = 'Ungeeignet'
)
UPDATE "Contact" c
SET "stageId" = ranked.keeper_id
FROM ranked
WHERE ranked.rn > 1 AND c."stageId" = ranked.id;

WITH ranked AS (
  SELECT id, "pipelineId",
         ROW_NUMBER() OVER (
           PARTITION BY "pipelineId"
           ORDER BY "isRejected" DESC, "order" ASC, id ASC
         ) AS rn
  FROM "Stage"
  WHERE name = 'Ungeeignet'
)
DELETE FROM "Stage" s
USING ranked
WHERE s.id = ranked.id AND ranked.rn > 1;
