"use client";

import { useState, useTransition } from "react";
import { createWebhookEndpoint } from "@/lib/actions/webhooks";
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
  WEBHOOK_SOURCES,
  WEBHOOK_SOURCE_COLORS,
  WEBHOOK_SOURCE_DESCRIPTIONS,
  WEBHOOK_SOURCE_LABELS,
} from "@/lib/webhook-source-labels";

export function AddSourceDialog({ pipelineId, existingSources }: { pipelineId: string; existingSources: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const availableSources = WEBHOOK_SOURCES.filter((source) => !existingSources.includes(source));

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createWebhookEndpoint(undefined, formData);
      if (result) {
        setError(result);
      } else {
        setError(undefined);
        setOpen(false);
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
          setError(undefined);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>+ Neue Quelle</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Quelle hinzufügen</DialogTitle>
          <DialogDescription>Wähle, woher diese Kampagne Leads oder Bewerbungen erhalten soll.</DialogDescription>
        </DialogHeader>

        {availableSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Alle verfügbaren Quellen sind bereits eingerichtet.</p>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="pipelineId" value={pipelineId} />
            <input type="hidden" name="source" value={selected ?? ""} />

            <div className="grid grid-cols-2 gap-2">
              {availableSources.map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSelected(source)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    selected === source ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
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
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={!selected || isPending} className="self-end">
              {isPending ? "Wird hinzugefügt..." : "Quelle hinzufügen"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
