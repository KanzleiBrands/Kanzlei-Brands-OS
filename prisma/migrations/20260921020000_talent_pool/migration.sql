-- Talent pools: a contact used to have a single unnamed talentPool boolean.
-- Clients can now create and name as many pools as they like, org-wide
-- (not tied to one campaign).

CREATE TABLE "TalentPool" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TalentPool_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentPool_organizationId_idx" ON "TalentPool"("organizationId");

ALTER TABLE "TalentPool"
  ADD CONSTRAINT "TalentPool_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contact" ADD COLUMN "talentPoolId" TEXT;

-- Data migration: every contact previously flagged talentPool=true moves
-- into one default "Talentpool" pool per organization, so nothing already
-- saved there is lost.
INSERT INTO "TalentPool" ("id", "organizationId", "name")
SELECT 'tp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), org_id, 'Talentpool'
FROM (
  SELECT DISTINCT p."organizationId" AS org_id
  FROM "Contact" c
  JOIN "Pipeline" p ON p.id = c."pipelineId"
  WHERE c."talentPool" = true
) orgs_with_pool;

UPDATE "Contact" c
SET "talentPoolId" = tp.id
FROM "Pipeline" p, "TalentPool" tp
WHERE p.id = c."pipelineId"
  AND tp."organizationId" = p."organizationId"
  AND tp.name = 'Talentpool'
  AND c."talentPool" = true;

ALTER TABLE "Contact" DROP COLUMN "talentPool";

CREATE INDEX "Contact_talentPoolId_idx" ON "Contact"("talentPoolId");

ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_talentPoolId_fkey"
  FOREIGN KEY ("talentPoolId") REFERENCES "TalentPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
