"use client";

import { useActionState } from "react";
import { updateDataRetentionSettings } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DataRetentionForm({
  organizationId,
  applicantDataRetentionMonths,
  leadDataRetentionMonths,
}: {
  organizationId: string;
  applicantDataRetentionMonths: number | null;
  leadDataRetentionMonths: number | null;
}) {
  const [error, formAction, isPending] = useActionState(updateDataRetentionSettings, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="applicantDataRetentionMonths" className="text-sm text-muted-foreground">
          Abgelehnte Bewerber (Recruiting) vollständig löschen nach (Monate)
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="applicantDataRetentionMonths"
            name="applicantDataRetentionMonths"
            type="number"
            min={1}
            step={1}
            placeholder="Deaktiviert"
            defaultValue={applicantDataRetentionMonths ?? ""}
            className="max-w-40"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Empfehlung: 6 Monate. Ein abgelehnter Bewerber kann laut § 15 Abs. 4 AGG innerhalb von 2 Monaten nach der
          Absage einen Entschädigungsanspruch geltend machen, danach bleiben laut § 61b ArbGG weitere 3 Monate für
          eine Klage - 6 Monate decken diese Fristen plus einen Sicherheitspuffer ab.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="leadDataRetentionMonths" className="text-sm text-muted-foreground">
          Nicht zustande gekommene Mandatsanfragen vollständig löschen nach (Monate)
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="leadDataRetentionMonths"
            name="leadDataRetentionMonths"
            type="number"
            min={1}
            step={1}
            placeholder="Deaktiviert"
            defaultValue={leadDataRetentionMonths ?? ""}
            className="max-w-40"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Für Anfragen ohne zustande gekommenes Mandat gibt es keine gesetzliche Mindestfrist - nach dem Grundsatz
          der Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO) sollten die Daten gelöscht werden, sobald der Zweck
          entfällt. In der Praxis üblich und empfohlen: 6 Monate.
        </p>
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Speichern..." : "Speichern"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Gilt kundenweit für alle Kampagnen des jeweiligen Typs. Betrifft nur Kontakte in einer Ungeeignet-Stufe.
        Der gesamte Kontakt wird unwiderruflich gelöscht (nicht nur anonymisiert). Nicht rückgängig zu machen. Leer
        lassen = deaktiviert. Für den Kunden ist diese Einstellung unter Einstellungen → Datenschutz einsehbar.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
