-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "applicantsQuota" SET DEFAULT 0,
ALTER COLUMN "leadsQuota" SET DEFAULT 0;

-- Backfill: a client that has never had a single campaign of a given kind
-- (no Pipeline row of that kind at all) currently sits at NULL ("kein
-- Limit"), which CampaignRequestCard's quotaExhausted check reads as
-- "unlimited" - letting a client self-serve request a first campaign they
-- never booked at all. Set those to 0 so self-serve stays locked until the
-- agency assigns real quota. A client that already has at least one
-- campaign of that kind keeps NULL untouched (deliberately "unlimited
-- additional" for an already-active client), since that is not the bug
-- being fixed here.
UPDATE "Organization"
SET "leadsQuota" = 0
WHERE "type" = 'CLIENT'
  AND "leadsQuota" IS NULL
  AND "id" NOT IN (SELECT DISTINCT "organizationId" FROM "Pipeline" WHERE "kind" = 'LEADS');

UPDATE "Organization"
SET "applicantsQuota" = 0
WHERE "type" = 'CLIENT'
  AND "applicantsQuota" IS NULL
  AND "id" NOT IN (SELECT DISTINCT "organizationId" FROM "Pipeline" WHERE "kind" = 'APPLICANTS');
