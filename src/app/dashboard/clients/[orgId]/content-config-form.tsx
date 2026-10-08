"use client";

import { useActionState } from "react";
import { updateContentConfig } from "@/lib/actions/content-ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSaveToast } from "@/hooks/use-save-toast";

/**
 * Die "Firma"-Grundlagen für die KI-Ideen-Generierung (Webseite + Marken-DNA),
 * siehe updateContentConfig in content-ideas.ts. Lebt im "Konfiguration"-
 * Reiter des Content Boards (content-config-panel.tsx) statt in den
 * Kundeneinstellungen, damit es beim Content-Arbeiten in der Nähe bleibt.
 */
export function ContentConfigForm({
  organizationId,
  websiteUrl,
  brandDna,
}: {
  organizationId: string;
  websiteUrl: string;
  brandDna: string;
}) {
  const [error, formAction, isPending] = useActionState(updateContentConfig, undefined);
  useSaveToast(error, isPending, "Konfiguration gespeichert.");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="organizationId" value={organizationId} />

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
