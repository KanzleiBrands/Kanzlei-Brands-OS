"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function FinalStageDialog({
  open,
  onOpenChange,
  pipelineKind,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineKind: string;
  onConfirm: (value: { startDate?: string; dealVolumeEur?: string }) => void;
  isPending: boolean;
}) {
  const isApplicant = pipelineKind === "APPLICANTS";
  const [value, setValue] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isApplicant ? "Bewerber eingestellt" : "Lead gewonnen"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isApplicant
            ? "Wann startet die Person? Wird für die Kampagnen-Statistik erfasst."
            : "Für welches Auftragsvolumen wurde der Mandant gewonnen? Wird als KPI in der Kundenübersicht erfasst."}
        </p>
        <Input
          type={isApplicant ? "date" : "number"}
          min={isApplicant ? undefined : 0}
          step={isApplicant ? undefined : 1}
          placeholder={isApplicant ? undefined : "Dealvolumen in Euro"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!value || isPending}
            onClick={() => onConfirm(isApplicant ? { startDate: value } : { dealVolumeEur: value })}
          >
            {isPending ? "Wird gespeichert..." : "Bestätigen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
