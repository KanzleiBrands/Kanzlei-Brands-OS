"use client";

import { useActionState } from "react";
import { updatePipelineDataRetention } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DataRetentionForm({
  pipelineId,
  rejectedDataRetentionMonths,
}: {
  pipelineId: string;
  rejectedDataRetentionMonths: number | null;
}) {
  const [error, formAction, isPending] = useActionState(updatePipelineDataRetention, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <label htmlFor="rejectedDataRetentionMonths" className="text-sm text-muted-foreground">
        Abgelehnte Bewerber dieser Kampagne automatisch anonymisieren nach (Monate)
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="rejectedDataRetentionMonths"
          name="rejectedDataRetentionMonths"
          type="number"
          min={1}
          step={1}
          placeholder="Deaktiviert"
          defaultValue={rejectedDataRetentionMonths ?? ""}
          className="max-w-40"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Speichern..." : "Speichern"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Empfehlung: 6 Monate. Ein abgelehnter Bewerber kann laut § 15 Abs. 4 AGG innerhalb von 2 Monaten nach der
        Absage einen Entschädigungsanspruch geltend machen, danach bleiben laut § 61b ArbGG weitere 3 Monate für
        eine Klage - 6 Monate decken diese Fristen plus einen Sicherheitspuffer ab.
      </p>
      <p className="text-sm text-muted-foreground">
        Betrifft nur Kontakte in einer Ungeeignet-Stufe. Name, Kontaktdaten, Lebenslauf und Zusatzangaben werden
        entfernt, die Kampagnen-Statistik bleibt erhalten. Nicht rückgängig zu machen. Leer lassen = deaktiviert.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
