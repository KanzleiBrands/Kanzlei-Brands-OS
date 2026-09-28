-- Ein Mitarbeiter kann mehrere interne Abteilungen/Rollen gleichzeitig haben
-- (z.B. Fulfillment + internes Marketing) statt nur einer - siehe
-- src/lib/super-admin.ts / sidebar-nav.tsx.

-- 1. Neue Array-Spalte anlegen
ALTER TABLE "User" ADD COLUMN "departments" "AgencyDepartment"[] NOT NULL DEFAULT '{}';

-- 2. Bestehende Einzel-Abteilung in die neue Array-Spalte übernehmen
UPDATE "User" SET "departments" = ARRAY["department"]::"AgencyDepartment"[] WHERE "department" IS NOT NULL;

-- 3. Alte Spalte entfernen
ALTER TABLE "User" DROP COLUMN "department";
