"use client";

import { useState } from "react";
import { rejectionReasonsFor } from "@/lib/rejection-reasons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function RejectionReasonDialog({
  open,
  onOpenChange,
  pipelineKind,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineKind: string;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const reasons = rejectionReasonsFor(pipelineKind);
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Absagegrund</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Damit wir für euch nachvollziehen können, woran es liegt, wenn {pipelineKind === "APPLICANTS" ? "Kandidaten" : "Interessenten"} nicht zum Abschluss kommen.
        </p>
        <Select value={reason} onValueChange={(value) => setReason(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(value: string) => value || "Grund auswählen"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {reasons.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={!reason || isPending} onClick={() => onConfirm(reason)}>
            {isPending ? "Wird gespeichert..." : "Bestätigen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
