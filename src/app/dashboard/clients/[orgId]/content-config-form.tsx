"use client";

import { useActionState, useState } from "react";
import { updateContentConfig } from "@/lib/actions/content-ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSaveToast } from "@/hooks/use-save-toast";

export type ContentIntentionValue = "RECRUITING" | "MANDATSAKQUISE" | "BEIDE";

const INTENTION_OPTIONS: { value: ContentIntentionValue; label: string }[] = [
  { value: "RECRUITING", label: "Recruiting" },
  { value: "MANDATSAKQUISE", label: "Mandatsakquise" },
  { value: "BEIDE", label: "Beides" },
];

/**
 * Die "Firma"-Grundlagen für die KI-Ideen-Generierung (Zielintention +
 * Webseite + Marken-DNA), siehe updateContentConfig in content-ideas.ts.
 * Lebt im "Konfiguration"-Reiter des Content Boards (content-config-panel.tsx)
 * statt in den Kundeneinstellungen, damit es beim Content-Arbeiten in der
 * Nähe bleibt. Zielintention ist eine bewusste Auswahl - NICHT automatisch
 * aus gebuchten Kampagnen abgeleitet, weil ein Kunde beides gebucht haben,
 * den Content aber nur auf eines davon ausrichten wollen kann.
 */
export function ContentConfigForm({
  organizationId,
  websiteUrl,
  brandDna,
  intention,
}: {
  organizationId: string;
  websiteUrl: string;
  brandDna: string;
  intention: ContentIntentionValue | null;
}) {
  const [error, formAction, isPending] = useActionState(updateContentConfig, undefined);
  useSaveToast(error, isPending, "Konfiguration gespeichert.");
  const [selectedIntention, setSelectedIntention] = useState<ContentIntentionValue | null>(intention);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="contentIntention" value={selectedIntention ?? ""} />

      <div className="flex flex-col gap-1">
        <Label>Zielintention</Label>
        <div className="flex gap-1.5">
          {INTENTION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={selectedIntention === option.value ? "default" : "outline"}
              onClick={() => setSelectedIntention(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Worauf soll der Content für diesen Kunden einzahlen?</p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="content-config-website">Webseite</Label>
        <Input id="content-config-website" name="contentWebsiteUrl" type="url" placeholder="https://..." defaultValue={websiteUrl} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="content-config-brand-dna">Marken-DNA</Label>
        <Textarea
          id="content-config-brand-dna"
          name="contentBrandDna"
          rows={6}
          defaultValue={brandDna}
          placeholder="Angebot, Zielgruppe, Tonalität, Positionierung, Alleinstellungsmerkmale... - wird bei jeder KI-Ideen- und Texterstellung für diesen Kunden berücksichtigt."
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Wird gespeichert..." : "Speichern"}
      </Button>
    </form>
  );
}
