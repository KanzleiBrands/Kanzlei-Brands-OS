import type { AutomationTrigger, PipelineKind } from "@prisma/client";

/** "Lead" for Mandatsakquise, "Bewerber" for Recruiting - matches the wording already used elsewhere per campaign kind. */
export function automationTriggerLabel(trigger: AutomationTrigger, pipelineKind: PipelineKind): string {
  const noun = pipelineKind === "APPLICANTS" ? "Bewerber" : "Lead";
  switch (trigger) {
    case "NEW_LEAD":
      return `Neuer ${noun}`;
    case "UNPROCESSED_24H":
      return `${noun} 24 Std. unbearbeitet`;
    case "UNPROCESSED_72H":
      return `${noun} 72 Std. unbearbeitet`;
  }
}

export const AUTOMATION_TRIGGERS: AutomationTrigger[] = ["NEW_LEAD", "UNPROCESSED_24H", "UNPROCESSED_72H"];
