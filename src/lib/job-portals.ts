// Katalog gängiger deutscher Stellenportale fürs Multiposting. Rein
// informative Checkliste (JobPosting.targetPortals) - keines dieser Portale
// ist aktuell technisch angebunden, siehe JobPostingForm.
export type JobPortal = { key: string; label: string; note?: string };

export const JOB_PORTALS: JobPortal[] = [
  { key: "indeed", label: "Indeed", note: "Organischer XML-Feed ist kostenlos" },
  { key: "google_jobs", label: "Google for Jobs", note: "Kostenlos über strukturierte Daten auf der Karriereseite" },
  { key: "arbeitsagentur", label: "Jobbörse (Bundesagentur für Arbeit)", note: "Kostenlose Schnittstelle" },
  { key: "stepstone", label: "StepStone" },
  { key: "xing", label: "XING Jobs" },
  { key: "linkedin", label: "LinkedIn Jobs" },
  { key: "meinestadt", label: "meinestadt.de" },
  { key: "kimeta", label: "Kimeta" },
  { key: "jobrapido", label: "Jobrapido" },
  { key: "kalaydo", label: "Kalaydo" },
];
