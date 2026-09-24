export const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Kunde angelegt",
  "user.created": "Nutzer angelegt",
  "pipeline.created": "Kampagne angelegt",
  "pipeline.deleted": "Kampagne gelöscht",
  "pipeline_access.granted": "Kampagnen-Zugriff gewährt",
  "pipeline_access.revoked": "Kampagnen-Zugriff entzogen",
  "contact.deleted": "Kontakt gelöscht",
  "contacts.csv_imported": "Kontakte per CSV importiert",
  "user.activated": "Zugang aktiviert",
  "user.deleted": "Mitarbeiter gelöscht",
  "organization.archived": "Kunde archiviert",
  "organization.reactivated": "Kunde reaktiviert",
  "organization.renamed": "Kunde umbenannt",
  "pipeline.renamed": "Kampagne umbenannt",
  "contact.stage_changed": "Kontakt-Status geändert",
  "contact.viewed": "Kontakt angesehen",
  "offer_interest.created": "Interesse an Angebot bekundet",
  "user.password_changed": "Passwort geändert",
  "user.email_changed": "E-Mail geändert",
  "system_email.password_reset": "Passwort-zurücksetzen-Mail gesendet",
  "system_email.portal_invite": "Zugangs-Einladung gesendet",
  "system_email.new_lead_notification": "Lead-Benachrichtigung gesendet",
  "system_email.new_applicant_notification": "Bewerbungs-Benachrichtigung gesendet",
};

/** For a "system_email.*" audit entry, the "an <to> - <subject>" subtitle shown under its action label. */
export function emailLogSubtitle(entry: { action: string; metadata: unknown }): string | null {
  if (!entry.action.startsWith("system_email.")) return null;
  const metadata = entry.metadata as { to?: unknown; subject?: unknown } | null;
  if (!metadata || typeof metadata !== "object") return null;
  const to = typeof metadata.to === "string" ? metadata.to : null;
  const subject = typeof metadata.subject === "string" ? metadata.subject : null;
  if (!to && !subject) return null;
  return [to ? `an ${to}` : null, subject].filter(Boolean).join(" - ");
}
