import type { SystemEmailType } from "@prisma/client";

export type SystemEmailContent = {
  label: string;
  description: string;
  /** Placeholders this type's subject/heading/body/footerNote may use. */
  placeholders: { token: string; description: string }[];
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  footerNote: string;
};

/**
 * Shipped defaults for every automated email, used whenever the agency
 * hasn't (yet) customized a type in the E-Mail-Center - see
 * src/lib/email/system-email.ts#getSystemEmailContent. Editing a type there
 * writes a SystemEmailTemplate row that overrides these.
 */
export const SYSTEM_EMAIL_DEFAULTS: Record<SystemEmailType, SystemEmailContent> = {
  PASSWORD_RESET: {
    label: "Passwort zurücksetzen",
    description: "Geht raus, wenn jemand über \"Passwort vergessen\" ein neues Passwort anfordert.",
    placeholders: [{ token: "{{name}}", description: "Name des Empfängers" }],
    subject: "Passwort zurücksetzen - Kanzlei Brands",
    heading: "Moin {{name}},",
    body: "du hast eine Passwort-Zurücksetzung angefordert. Klicke auf den Button, um ein neues Passwort festzulegen.",
    ctaLabel: "Passwort zurücksetzen",
    footerNote:
      "Der Link ist 7 Tage gültig. Falls du das nicht warst, kannst du diese E-Mail einfach ignorieren - dein Passwort bleibt dann unverändert.",
  },
  PORTAL_INVITE: {
    label: "Zugangs-Einladung",
    description: "Geht raus, wenn ein neuer Kunden-Nutzer angelegt wird und sein Kundenportal-Zugang bereitsteht.",
    placeholders: [{ token: "{{name}}", description: "Vorname des Empfängers" }],
    subject: "Zugang zu deinem Kanzlei Brands Kundenportal",
    heading: "Moin {{name}},",
    body: "dein Zugang zum Kanzlei Brands Kundenportal ist bereit. Lege dort dein Passwort fest und leg direkt los.",
    ctaLabel: "Zugang aktivieren",
    footerNote: "",
  },
  NEW_LEAD_NOTIFICATION: {
    label: "Neuer Lead",
    description: "Geht an alle berechtigten Nutzer eines Kunden, sobald ein neuer Lead in einer Kampagne eingeht.",
    placeholders: [
      { token: "{{name}}", description: "Name des Empfängers" },
      { token: "{{kampagne}}", description: "Name der Kampagne" },
    ],
    subject: "Neuer Lead für {{kampagne}}",
    heading: "Moin {{name}},",
    body: 'du hast einen neuen Lead für die Kampagne "{{kampagne}}" erhalten.',
    ctaLabel: "Lead öffnen",
    footerNote: "",
  },
  NEW_APPLICANT_NOTIFICATION: {
    label: "Neue Bewerbung",
    description: "Geht an alle berechtigten Nutzer eines Kunden, sobald eine neue Bewerbung in einer Kampagne eingeht.",
    placeholders: [
      { token: "{{name}}", description: "Name des Empfängers" },
      { token: "{{kampagne}}", description: "Name der Kampagne" },
    ],
    subject: "Neue Bewerbung für {{kampagne}}",
    heading: "Moin {{name}},",
    body: 'du hast eine neue Bewerbung für die Kampagne "{{kampagne}}" erhalten.',
    ctaLabel: "Bewerbung öffnen",
    footerNote: "",
  },
  ABSENCE_REQUEST_SUBMITTED: {
    label: "Neuer Abwesenheitsantrag",
    description: "Geht an die zuständige Führungskraft (laut Organigramm) oder die GF, sobald ein Mitarbeiter einen Abwesenheitsantrag stellt.",
    placeholders: [
      { token: "{{name}}", description: "Name des Empfängers (Genehmiger*in)" },
      { token: "{{mitarbeiter}}", description: "Name des antragstellenden Mitarbeiters" },
      { token: "{{art}}", description: "Abwesenheitsart, z.B. Urlaub" },
      { token: "{{zeitraum}}", description: "Zeitraum, z.B. 12.09.2026 - 19.09.2026" },
      { token: "{{tage}}", description: "Anzahl der beantragten Werktage" },
    ],
    subject: "Neuer Abwesenheitsantrag von {{mitarbeiter}}",
    heading: "Moin {{name}},",
    body: "{{mitarbeiter}} hat einen Antrag auf \"{{art}}\" für den Zeitraum {{zeitraum}} ({{tage}} Tage) gestellt und wartet auf deine Entscheidung.",
    ctaLabel: "Antrag prüfen",
    footerNote: "",
  },
  ABSENCE_REQUEST_DECIDED: {
    label: "Abwesenheitsantrag entschieden",
    description: "Geht an den Mitarbeiter, sobald sein Abwesenheitsantrag genehmigt oder abgelehnt wurde.",
    placeholders: [
      { token: "{{name}}", description: "Name des Empfängers (Antragsteller*in)" },
      { token: "{{art}}", description: "Abwesenheitsart, z.B. Urlaub" },
      { token: "{{zeitraum}}", description: "Zeitraum, z.B. 12.09.2026 - 19.09.2026" },
      { token: "{{entscheidung}}", description: "genehmigt oder abgelehnt" },
    ],
    subject: "Dein Abwesenheitsantrag wurde {{entscheidung}}",
    heading: "Moin {{name}},",
    body: "dein Antrag auf \"{{art}}\" für den Zeitraum {{zeitraum}} wurde {{entscheidung}}.",
    ctaLabel: "Meine Abwesenheiten öffnen",
    footerNote: "",
  },
};

export const SYSTEM_EMAIL_TYPES = Object.keys(SYSTEM_EMAIL_DEFAULTS) as SystemEmailType[];
