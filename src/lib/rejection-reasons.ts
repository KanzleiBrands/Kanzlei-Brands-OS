/**
 * Fixed, kind-specific rejection reasons captured whenever a contact is
 * moved into an isRejected stage, so the agency can analyze per client
 * *why* leads/applicants don't convert (Performance-Check).
 */
export const REJECTION_REASONS: Record<"LEADS" | "APPLICANTS", string[]> = {
  APPLICANTS: [
    "Kandidat zu teuer",
    "Fähigkeiten passen nicht",
    "Kandidat nicht erreichbar",
    "Kandidat hat Angebot abgelehnt",
    "Kandidat unzuverlässig / nicht erschienen",
  ],
  LEADS: [
    "Zielgruppe passt nicht",
    "Interessent nicht erreichbar",
    "Angebot abgelehnt",
    "Preis/Honorar passt nicht",
    "Kein Bedarf aktuell",
  ],
};

export function rejectionReasonsFor(pipelineKind: string): string[] {
  return pipelineKind === "APPLICANTS" ? REJECTION_REASONS.APPLICANTS : REJECTION_REASONS.LEADS;
}
