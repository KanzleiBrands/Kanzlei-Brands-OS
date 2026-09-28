/**
 * Echter Super-Admin: kann sich zur Prüfung von Board-Ansichten/
 * Einstellungen als JEDER Mitarbeiter anmelden (siehe
 * src/lib/actions/impersonation.ts -> startEmployeeImpersonation). Bewusst
 * NICHT an die Rolle AGENCY_ADMIN gekoppelt (die auch an Fulfillment-
 * Mitarbeitende für vollen CRM-Zugriff vergeben wird - siehe
 * new-agency-user-form.tsx und den Cashflow-Cockpit-Vorfall, der genau
 * diese Verwechslung ausgenutzt hat, src/lib/cashflow-access.ts) und
 * bewusst nicht als Datenbank-Flag, das versehentlich auf mehrere Accounts
 * gesetzt werden könnte - ein fest verdrahteter Einzel-Account.
 */
const SUPER_ADMIN_EMAIL = "lukas@kanzlei-brands.de";

export function isSuperAdmin(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
}
