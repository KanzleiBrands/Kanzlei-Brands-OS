"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setFinalStage } from "@/lib/actions/organizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Stage = { id: string; name: string };

export function FinalStageSelector({
  pipelineId,
  stages,
  finalStageId,
}: {
  pipelineId: string;
  stages: Stage[];
  finalStageId?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-1 text-sm text-muted-foreground">Erfolgs-Stufe (Eingestellt/Gewonnen)</p>
      <p className="mb-2 text-sm text-muted-foreground">
        Beim Verschieben eines Kontakts in diese Stufe erscheint das Popup für Einstellungsdatum bzw. Dealvolumen,
        und nur Kontakte hier zählen in den Statistiken als Einstellung/Abschluss.
      </p>
      <Select
        value={finalStageId ?? ""}
        disabled={isPending}
        onValueChange={(value) => {
          if (!value) return;
          const formData = new FormData();
          formData.set("pipelineId", pipelineId);
          formData.set("stageId", value);
          startTransition(async () => {
            try {
              await setFinalStage(formData);
              toast.success("Gespeichert.");
            } catch {
              toast.error("Konnte nicht gespeichert werden.");
            }
          });
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue>{(value: string) => stages.find((s) => s.id === value)?.name ?? "Stufe wählen"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!finalStageId && (
        <p className="mt-2 text-sm text-destructive">
          Keine Erfolgs-Stufe gesetzt - Einstellungen/Abschlüsse werden für diese Kampagne nicht erfasst.
        </p>
      )}
    </div>
  );
}
