"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateContentBrandDna } from "@/lib/actions/content-ideas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

/**
 * Freitext-Grundlage ("Marken-DNA") pro Kunde, die in jede KI-Generierung
 * (Ideen + Volltext, siehe content-ideas.ts) einfließt - Angebot, Zielgruppe,
 * Tonalität, Positionierung etc. Reines Formular ohne Dialog/Card-Wrapper,
 * damit es sich sowohl in die Kundeneinstellungen (settings-tab.tsx) als
 * auch in einen Dialog (content-brand-dna-dialog.tsx) einbetten lässt.
 */
export function ContentBrandDnaForm({
  organizationId,
  value,
  onSaved,
}: {
  organizationId: string;
  value: string;
  /** Wird nach erfolgreichem Speichern aufgerufen - z.B. um einen umschließenden Dialog zu schließen. */
  onSaved?: () => void;
}) {
  const [error, formAction, isPending] = useActionState(updateContentBrandDna, undefined);
  useSaveToast(error, isPending, "Marken-DNA gespeichert.");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) onSaved?.();
    wasPending.current = isPending;
  }, [isPending, error, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <Textarea
        name="contentBrandDna"
        rows={6}
        defaultValue={value}
        placeholder="Angebot, Zielgruppe, Tonalität, Positionierung, Alleinstellungsmerkmale... - wird bei jeder KI-Ideen- und Texterstellung für diesen Kunden berücksichtigt."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Wird gespeichert..." : "Speichern"}
      </Button>
    </form>
  );
}
