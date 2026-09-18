export const STAGE_TEMPLATES = {
  LEADS: [
    { name: "Neu", order: 0, color: "#3B82F6" },
    { name: "In Bearbeitung", order: 1, color: "#F59E0B" },
    { name: "Abgeschlossen", order: 2, color: "#22C55E" },
  ],
  APPLICANTS: [
    { name: "Unbearbeitet", order: 0, color: "#3B82F6" },
    { name: "In Kontakt", order: 1, color: "#F59E0B" },
    { name: "Nicht erreicht", order: 2, color: "#8B5CF6" },
    { name: "Vorstellungsgespräch", order: 3, color: "#22C55E" },
    { name: "Absage", order: 4, color: "#EF4444" },
  ],
} as const;
