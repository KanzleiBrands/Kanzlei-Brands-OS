-- Monatlicher Performance-Report war fälschlich für ALLE Kunden per-Default
-- aktiv (siehe Organization.monthlyReportEnabled @default(true)), wodurch
-- am Monatsende auch noch nicht aktiv eingepflegte Kunden einen Report über
-- eine leere/inaktive Kampagne bekommen haben. Ab jetzt: Default AUS, und
-- bestehende Kunden werden einmalig zurückgesetzt - die Agentur aktiviert
-- den Report bewusst pro Kunde, sobald dessen Kampagne gestartet ist.
ALTER TABLE "Organization" ALTER COLUMN "monthlyReportEnabled" SET DEFAULT false;

UPDATE "Organization" SET "monthlyReportEnabled" = false WHERE "type" = 'CLIENT';
