-- CRM-Vorlage: "Ungeeignet"-Stufe ergänzen, analog zur ATS-Vorlage's "Absage",
-- damit neue Mandatsakquise-Kampagnen den Qualifiziert/Ungeeignet-Mechanismus
-- sofort nutzen können, ohne die Statusvorlage manuell nachzubearbeiten.
UPDATE "StageTemplate"
SET "stages" = "stages" || '[{"name": "Ungeeignet", "color": "#EF4444", "order": 3, "isRejected": true}]'::jsonb
WHERE id = 'seed-template-crm';

-- Bestehende Mandatsakquise-Kampagnen ohne Ausschluss-Stufe bekommen eine
-- neue "Ungeeignet"-Spalte ans Ende ihres Kanban angehängt. Rein additiv:
-- vorhandene Stufen (z.B. "Verloren") werden nicht umbenannt oder entfernt.
INSERT INTO "Stage" (id, name, "order", color, "isRejected", "pipelineId", "createdAt")
SELECT
  gen_random_uuid()::text,
  'Ungeeignet',
  COALESCE((SELECT MAX(s2."order") FROM "Stage" s2 WHERE s2."pipelineId" = p.id), -1) + 1,
  '#EF4444',
  true,
  p.id,
  now()
FROM "Pipeline" p
WHERE p.kind = 'LEADS'
  AND NOT EXISTS (
    SELECT 1 FROM "Stage" s WHERE s."pipelineId" = p.id AND s."isRejected" = true
  );
