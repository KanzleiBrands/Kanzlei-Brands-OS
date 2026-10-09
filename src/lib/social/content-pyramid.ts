/**
 * Die Content-Pyramide: ein fixes, kundenübergreifendes Strategie-Rahmenwerk
 * dafür, WOFÜR ein Beitrag gedacht ist - unabhängig vom Thema des jeweiligen
 * Kunden und unabhängig vom Copywriting-Framework/Format (die bestimmen die
 * AUSGESTALTUNG, nicht die strategische Ausrichtung). Gilt identisch für
 * jeden Kunden UND fürs interne Marketing-Center - nur die konkreten Themen
 * sind pro Kunde unterschiedlich. Das Ziel-Verhältnis 60/30/10 ist bewusst
 * nicht pro Kunde einstellbar, siehe content-pyramid-overview.tsx (Quality
 * Control: Ist-Verteilung der aktuellen Beiträge gegen dieses feste Ziel).
 */

export type ContentPyramidStageValue = "REACH" | "EDUCATION" | "CONVERSION";

export type ContentPyramidStageOption = {
  value: ContentPyramidStageValue;
  label: string;
  targetPercent: number;
  /** Kurzbeschreibung fürs UI (Auswahl-Hilfetext). */
  shortDescription: string;
  /** Fließt in den KI-Prompt bei der Ideen-Generierung ein - bewusst themen-/kundenneutral. */
  promptGuidance: string;
};

export const PYRAMID_STAGE_OPTIONS: ContentPyramidStageOption[] = [
  {
    value: "REACH",
    label: "Reichweite",
    targetPercent: 60,
    shortDescription: "Aufmerksamkeit, neue Menschen erreichen, Shares und Follower-Wachstum.",
    promptGuidance:
      "Reichweiten-Content: Ziel ist Aufmerksamkeit, Shares und neue Follower - auch bei Menschen, die (noch) keinen " +
      "konkreten Bedarf haben. Der Hook muss für ein breites Publikum verständlich und interessant sein, nicht nur für " +
      "die engste Zielgruppe. Kein Verkaufsdruck. Eine klare, nachvollziehbare These, Erkenntnis oder ein überraschender " +
      "Blickwinkel - konkret statt beliebig allgemein.",
  },
  {
    value: "EDUCATION",
    label: "Education",
    targetPercent: 30,
    shortDescription: "Vertrauen und Expertise aufbauen - spezifischer, mit echtem fachlichem Mehrwert.",
    promptGuidance:
      "Education-Content (Vertrauen & Expertise): Ziel ist, echte Fachkompetenz und Erfahrung zu zeigen. Darf " +
      "spezifischer und fachlicher sein als Reichweiten-Content. Konkrete Beispiele, Vorgehensweisen, Learnings oder " +
      "Ergebnisse statt vager Behauptungen - aber nur, was tatsächlich belegbar ist. Kein Verkaufsdruck, der Mehrwert " +
      "steht im Vordergrund.",
  },
  {
    value: "CONVERSION",
    label: "Conversion",
    targetPercent: 10,
    shortDescription: "Aufmerksamkeit und Vertrauen in eine konkrete Handlung umwandeln.",
    promptGuidance:
      "Conversion-Content: Ziel ist, Aufmerksamkeit und Vertrauen in eine konkrete Handlung umzuwandeln (Termin " +
      "buchen, Guide anfordern, Nachricht schreiben, Newsletter abonnieren o.ä.). Muss einen klaren, glaubwürdigen Call " +
      "to Action enthalten. Nicht jeder CTA muss direkt verkaufen - auch niedrigschwellige Handlungen zählen.",
  },
];

export function getPyramidStageOption(value: ContentPyramidStageValue): ContentPyramidStageOption {
  return PYRAMID_STAGE_OPTIONS.find((o) => o.value === value)!;
}

export function isValidPyramidStage(value: string): value is ContentPyramidStageValue {
  return PYRAMID_STAGE_OPTIONS.some((o) => o.value === value);
}
