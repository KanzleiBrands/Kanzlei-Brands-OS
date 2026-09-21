"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateDealOutcome } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

const eurFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function DealOutcomeEditor({
  contactId,
  pipelineKind,
  dealVolumeEur,
  startDate,
}: {
  contactId: string;
  pipelineKind: string;
  dealVolumeEur: number | null;
  startDate: string | null;
}) {
  const isApplicant = pipelineKind === "APPLICANTS";
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(updateDealOutcome, undefined);
  useSaveToast(error, isPending);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setEditing(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  if (!editing) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        {isApplicant
          ? `Startdatum: ${startDate ? new Date(startDate).toLocaleDateString("de-DE") : "noch nicht angegeben"}`
          : `Dealvolumen: ${dealVolumeEur != null ? eurFormatter.format(dealVolumeEur) : "noch nicht angegeben"}`}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={isApplicant ? "Startdatum bearbeiten" : "Dealvolumen bearbeiten"}
          className="text-muted-foreground hover:text-foreground"
        >
          <PencilIcon className="size-3.5" />
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      {isApplicant ? (
        <Input type="date" name="startDate" defaultValue={startDate ?? ""} autoFocus className="w-40" />
      ) : (
        <Input
          type="number"
          name="dealVolumeEur"
          min={0}
          step={1}
          placeholder="Dealvolumen in Euro"
          defaultValue={dealVolumeEur ?? ""}
          autoFocus
          className="w-40"
        />
      )}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "..." : "Speichern"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
        Abbrechen
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </form>
  );
}
