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
};

export const SYSTEM_EMAIL_TYPES = Object.keys(SYSTEM_EMAIL_DEFAULTS) as SystemEmailType[];
