"use client";

import { useActionState, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { updateContentBrandDna } from "@/lib/actions/content-ideas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

/**
 * Freitext-Grundlage ("Marken-DNA") pro Kunde, die in jede KI-Generierung
 * (Ideen + Volltext, siehe content-ideas.ts) einfließt - Angebot, Zielgruppe,
 * Tonalität, Positionierung etc.
 */
export function ContentBrandDna({ organizationId, value }: { organizationId: string; value: string }) {
  const [error, formAction, isPending] = useActionState(updateContentBrandDna, undefined);
  useSaveToast(error, isPending, "Marken-DNA gespeichert.");
  const [expanded, setExpanded] = useState(!value);

  return (
    <div className="rounded-lg border p-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left text-sm font-medium"
      >
        Marken-DNA für KI-Ideen-Generierung
        {expanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
      </button>
      {!expanded && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {value || "Noch nicht ausgefüllt - verbessert jede KI-generierte Idee und jeden Beitragstext."}
        </p>
      )}
      {expanded && (
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <Textarea
            name="contentBrandDna"
            rows={5}
            defaultValue={value}
            placeholder="Angebot, Zielgruppe, Tonalität, Positionierung, Alleinstellungsmerkmale... - wird bei jeder KI-Ideen- und Texterstellung für diesen Kunden berücksichtigt."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={isPending} className="self-start">
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </form>
      )}
    </div>
  );
}
