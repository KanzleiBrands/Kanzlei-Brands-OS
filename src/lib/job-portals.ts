// Katalog gängiger deutscher Stellenportale fürs Multiposting. Rein
// informative Checkliste (JobPosting.targetPortals) - keines dieser Portale
// ist aktuell technisch angebunden, siehe JobPostingForm.
//
// Stand September 2026: Indeed schafft den klassischen "Single-Source"-
// XML-Feed schrittweise ab (kostenlose Sichtbarkeit endet zum 31.03.2026,
// Agentur-Feeds spätestens zum 31.12.2026) - Indeed crawlt stattdessen
// öffentliche Stellenanzeigen-Seiten mit JobPosting-Strukturdaten, genau wie
// Google for Jobs. Deshalb ist /jobs/[pipelineId] (siehe job-schema.ts) der
// langfristig robustere Weg als ein klassischer Feed. Für einen echten
// Indeed-Feed als Agentur braucht jeder Kunde zusätzlich ein "Agency of
// Record"(AOR)-Dokument, weil ein Feed laut Indeed-Richtlinie nur Stellen
// eines einzigen Arbeitgebers enthalten darf. Die Bundesagentur für Arbeit
// verlangt für die HR-BA-XML-Schnittstelle einen Kooperationsvertrag mit der
// Agentur sowie je Kunde eine Vollmacht/Beauftragung, da der Kunde und nicht
// die Agentur als Arbeitgeber auftritt.
export type JobPortal = { key: string; label: string; note?: string };

export const JOB_PORTALS: JobPortal[] = [
  {
    key: "google_jobs",
    label: "Google for Jobs",
    note: "Automatisch, sobald die Stellenanzeige-Seite veröffentlicht ist - kein Account nötig",
  },
  {
    key: "indeed",
    label: "Indeed",
    note: "Klassischer XML-Feed wird 2026 abgeschafft; Indeed crawlt stattdessen unsere Stellenanzeige-Seite. Für einen eigenen Feed: AOR-Dokument je Kunde nötig",
  },
  {
    key: "arbeitsagentur",
    label: "Jobbörse (Bundesagentur für Arbeit)",
    note: "Kooperationsvertrag der Agentur mit der BA + Vollmacht je Kunde nötig (HR-BA-XML-Schnittstelle)",
  },
  { key: "stepstone", label: "StepStone", note: "Nur über einen Multiposting-Dienstleister" },
  { key: "xing", label: "XING Jobs", note: "Nur über einen Multiposting-Dienstleister" },
  { key: "linkedin", label: "LinkedIn Jobs", note: "Nur über einen Multiposting-Dienstleister" },
  { key: "meinestadt", label: "meinestadt.de", note: "Nur über einen Multiposting-Dienstleister" },
  { key: "kimeta", label: "Kimeta", note: "Nur über einen Multiposting-Dienstleister" },
  { key: "jobrapido", label: "Jobrapido", note: "Nur über einen Multiposting-Dienstleister" },
  { key: "kalaydo", label: "Kalaydo", note: "Nur über einen Multiposting-Dienstleister" },
];
