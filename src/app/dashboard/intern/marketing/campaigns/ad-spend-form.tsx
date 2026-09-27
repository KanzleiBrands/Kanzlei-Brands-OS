"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addManualAdSpend } from "@/lib/actions/attribution";
import { PLATFORM_LABELS } from "@/lib/attribution/constants";

const PLATFORM_KEYS = Object.keys(PLATFORM_LABELS) as (keyof typeof PLATFORM_LABELS)[];

export function AdSpendForm({ campaigns }: { campaigns: { id: string; name: string; platform: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await addManualAdSpend(formData);
        toast.success("Werbekosten gespeichert.");
        formRef.current?.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
      }
    });
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Kampagnen erkannt - Werbekosten können erst zugeordnet werden, sobald mindestens eine Kampagne existiert.</p>;
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Kampagne</label>
        <select name="campaignId" required className="h-9 rounded-md border border-input bg-background px-3 text-sm" defaultValue="">
          <option value="" disabled>
            Auswählen...
          </option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {PLATFORM_LABELS[c.platform as keyof typeof PLATFORM_LABELS] ?? c.platform} - {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Plattform</label>
        <select name="platform" required className="h-9 rounded-md border border-input bg-background px-3 text-sm" defaultValue="">
          <option value="" disabled>
            Auswählen...
          </option>
          {PLATFORM_KEYS.map((key) => (
            <option key={key} value={key}>
              {PLATFORM_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Datum</label>
        <Input type="date" name="date" required className="h-9 w-40" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Ausgabe (EUR)</label>
        <Input type="number" name="amountSpent" step="0.01" min="0" required className="h-9 w-32" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        Speichern
      </Button>
    </form>
  );
}
