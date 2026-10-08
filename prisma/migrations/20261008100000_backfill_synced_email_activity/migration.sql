-- Backfill: every EmailMessage synced before src/lib/mailbox/sync.ts also
-- started writing a matching Activity row never got one, so a mail thread
-- synced from Gmail/Outlook (instead of sent via the platform's own
-- "E-Mail senden" form) showed up in Posteingang but never in the contact's
-- own "E-Mail"-Tab-Verlauf (which reads only from Activity). Anti-joined on
-- contact+type+subject so an EmailMessage whose Activity already exists
-- (e.g. outbound mail sent through the platform, which already created
-- both rows together) is skipped rather than duplicated.
INSERT INTO "Activity" ("id", "type", "content", "contactId", "createdAt")
SELECT
  'act_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
  (CASE WHEN em."direction" = 'OUTBOUND' THEN 'EMAIL_OUT' ELSE 'EMAIL_IN' END)::"ActivityType",
  em."subject",
  em."contactId",
  em."sentAt"
FROM "EmailMessage" em
WHERE NOT EXISTS (
  SELECT 1 FROM "Activity" a
  WHERE a."contactId" = em."contactId"
    AND a."type" = (CASE WHEN em."direction" = 'OUTBOUND' THEN 'EMAIL_OUT' ELSE 'EMAIL_IN' END)::"ActivityType"
    AND (a."content" = em."subject" OR (a."content" IS NULL AND em."subject" IS NULL))
);
