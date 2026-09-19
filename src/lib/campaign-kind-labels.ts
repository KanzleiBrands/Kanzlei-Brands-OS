export const CAMPAIGN_KIND_LABELS: Record<string, string> = {
  LEADS: "Mandatsakquise",
  APPLICANTS: "Recruiting",
};

/** "Ungeeignet" for Mandatsakquise, "Ausgeschlossen" for Recruiting - the rejected-stage tab/label wording per campaign kind. */
export function excludedTabLabel(pipelineKind: string): string {
  return pipelineKind === "LEADS" ? "Ungeeignet" : "Ausgeschlossen";
}
