"use client";

import { useActionState, useRef, useState } from "react";
import { importContactsCsv } from "@/lib/actions/contacts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CsvImportDialog({ pipelineId }: { pipelineId: string }) {
  const [result, formAction, isPending] = useActionState(importContactsCsv, undefined);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isSuccess = result?.includes("importiert");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFileName(null);
          formRef.current?.reset();
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>CSV importieren</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kontakte per CSV importieren</DialogTitle>
          <DialogDescription>
            Spalten wie Vorname, Nachname, E-Mail, Telefon und Ort werden automatisch erkannt. Alle Kontakte landen in
            der ersten Stufe dieser Pipeline.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="rounded-md border border-input px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
          {fileName && <p className="text-xs text-muted-foreground">Ausgewählt: {fileName}</p>}

          {result && (
            <p className={`text-sm ${isSuccess ? "text-emerald-500" : "text-destructive"}`}>{result}</p>
          )}

          <Button type="submit" disabled={isPending} className="self-end">
            {isPending ? "Importiere..." : "Importieren"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
