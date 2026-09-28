/**
 * Cashflow Cockpit zeigt sensible Geschäftszahlen (Umsatz, Kosten, Gewinn) -
 * per expliziter Anweisung nur für die Geschäftsführung sichtbar. WICHTIG:
 * die Rolle AGENCY_ADMIN bedeutet in dieser App NICHT "ist Geschäftsführung"
 * - sie wird auch an Fulfillment-Mitarbeitende für vollen CRM-Zugriff
 * vergeben (siehe new-agency-user-form.tsx: "Fulfillment (voller
 * CRM-Zugriff)"). Ein früherer Bypass ("jeder AGENCY_ADMIN sieht das
 * Cockpit") hat dadurch versehentlich CRM-Vollzugriff mit
 * Geschäftsführungs-Zugriff gleichgesetzt - genau das hier behoben wird.
 *
 * OWNER_EMAIL ist ein bewusster, zusätzlicher Fallback: department ist
 * nullable, und ohne diesen Fallback könnte ein fehlendes department-Feld
 * den Geschäftsführer selbst aussperren. department=EXECUTIVE oder
 * hasCashflowAccess (Settings -> Team) bleiben die regulären Wege, weiteren
 * Personen gezielt Zugriff zu geben.
 */
const OWNER_EMAIL = "lukas@kanzlei-brands.de";

export function hasCashflowCockpitAccess(user: { email: string; department: string | null; hasCashflowAccess: boolean }): boolean {
  if (user.email.toLowerCase() === OWNER_EMAIL) return true;
  if (user.department === "EXECUTIVE") return true;
  return user.hasCashflowAccess;
}
