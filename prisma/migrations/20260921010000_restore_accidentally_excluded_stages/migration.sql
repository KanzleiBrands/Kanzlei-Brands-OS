-- The kanban board used to let anyone accidentally mark any stage as an
-- "Ausschluss-Stufe" (a misclick moved "Gewonnen"/"Verloren" columns out of
-- the qualified board entirely). That toggle has been removed from the UI;
-- this repairs any stage that got flipped that way, since a stage literally
-- named a win/loss outcome was never meant to be an exclusion stage.
UPDATE "Stage"
SET "isRejected" = false
WHERE "isRejected" = true
  AND "name" IN ('Gewonnen', 'Verloren');
