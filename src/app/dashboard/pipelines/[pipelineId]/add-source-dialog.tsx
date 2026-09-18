"use client";

import { useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { createWebhookEndpoint } from "@/lib/actions/webhooks";
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
import {
  WEBHOOK_FORM_SOURCES,
  DIRECT_INTEGRATION_SOURCES,
  WEBHOOK_SOURCE_COLORS,
  WEBHOOK_SOURCE_DESCRIPTIONS,
  WEBHOOK_SOURCE_LABELS,
} from "@/lib/webhook-source-labels";

function SourceTile({
  source,
  selected,
  onSelect,
}: {
  source: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
      }`}
    >
      <span
        className="flex size-7 items-center justify-center rounded-md text-xs font-semibold text-white"
        style={{ backgroundColor: WEBHOOK_SOURCE_COLORS[source] }}
      >
        {WEBHOOK_SOURCE_LABELS[source][0]}
      </span>
      <span className="text-sm font-medium">{WEBHOOK_SOURCE_LABELS[source]}</span>
      <span className="text-xs text-muted-foreground">{WEBHOOK_SOURCE_DESCRIPTIONS[source]}</span>
    </button>
  );
}

export function AddSourceDialog({ pipelineId, existingSources }: { pipelineId: string; existingSources: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const [csvResult, csvFormAction, isCsvPending] = useActionState(importContactsCsv, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const csvFormRef = useRef<HTMLFormElement>(null);
  const csvIsSuccess = csvResult?.includes("importiert");

  const availableFormSources = WEBHOOK_FORM_SOURCES.filter((source) => !existingSources.includes(source));
  const availableDirectSources = DIRECT_INTEGRATION_SOURCES.filter((source) => !existingSources.includes(source));

  function handleAddSource(formData: FormData) {
    startTransition(async () => {
      const result = await createWebhookEndpoint(undefined, formData);
      if (result) {
        setSourceError(result);
      } else {
        setSourceError(undefined);
        setSelected(null);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelected(null);
          setSourceError(undefined);
          setFileName(null);
          csvFormRef.current?.reset();
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>+ Neue Quelle</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Neue Quelle hinzufügen</DialogTitle>
          <DialogDescription>Wähle, woher diese Kampagne Leads oder Bewerbungen erhalten soll.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto pr-1">
          {availableFormSources.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Webhook</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Quelle auswählen und danach die Webhook-URL in deinem Tool hinterlegen.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableFormSources.map((source) => (
                  <SourceTile
                    key={source}
                    source={source}
                    selected={selected === source}
                    onSelect={() => setSelected(source)}
                  />
                ))}
              </div>
            </div>
          )}

          {availableDirectSources.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Direktintegrationen</p>
              <p className="mb-2 text-xs text-muted-foreground">Native Anbindung ohne manuelles Webhook-Setup.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableDirectSources.map((source) => (
                  <SourceTile
                    key={source}
                    source={source}
                    selected={selected === source}
                    onSelect={() => setSelected(source)}
                  />
                ))}
              </div>
            </div>
          )}

          {(availableFormSources.length > 0 || availableDirectSources.length > 0) && (
            <form
              action={(formData) => handleAddSource(formData)}
              className="flex flex-col gap-2 border-t pt-4"
            >
              <input type="hidden" name="pipelineId" value={pipelineId} />
              <input type="hidden" name="source" value={selected ?? ""} />
              {sourceError && <p className="text-sm text-destructive">{sourceError}</p>}
              <Button type="submit" disabled={!selected || isPending} className="self-end">
                {isPending ? "Wird hinzugefügt..." : "Quelle hinzufügen"}
              </Button>
            </form>
          )}

          <div className="border-t pt-4">
            <p className="mb-1 text-sm font-medium">CSV Upload</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Spalten wie Vorname, Nachname, E-Mail, Telefon und Ort werden automatisch erkannt. Alle Kontakte landen
              in der ersten Stufe dieser Pipeline (max. 2000 Zeilen).
            </p>
            <form ref={csvFormRef} action={csvFormAction} className="flex flex-col gap-2">
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
              {csvResult && (
                <p className={`text-sm ${csvIsSuccess ? "text-emerald-500" : "text-destructive"}`}>{csvResult}</p>
              )}
              <Button type="submit" disabled={isCsvPending} className="self-end">
                {isCsvPending ? "Importiere..." : "Importieren"}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
