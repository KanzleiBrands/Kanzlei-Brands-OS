export const CAMPAIGN_KIND_LABELS: Record<string, string> = {
  LEADS: "Mandatsakquise",
  APPLICANTS: "Recruiting",
};

/** The rejected-stage tab/label wording, unified across all campaign kinds. */
export function excludedTabLabel(_pipelineKind: string): string {
  return "Ungeeignet";
}
