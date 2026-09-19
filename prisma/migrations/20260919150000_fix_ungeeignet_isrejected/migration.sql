-- Data fix: a Stage literally named "Ungeeignet" is meant to be the
-- excluded/rejected stage everywhere (see 20260919100000_leads_ungeeignet_stage),
-- but some pipelines and stage templates ended up with it as a normal,
-- non-excluded stage - showing up as its own Kanban column instead of being
-- folded into the "Ungeeignet" tab. Correct any existing data.

UPDATE "Stage"
SET "isRejected" = true
WHERE name = 'Ungeeignet' AND "isRejected" = false;

UPDATE "StageTemplate"
SET stages = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'name' = 'Ungeeignet' AND (elem->>'isRejected' IS DISTINCT FROM 'true')
        THEN elem || '{"isRejected": true}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(stages) AS elem
)
WHERE stages::text LIKE '%Ungeeignet%';
