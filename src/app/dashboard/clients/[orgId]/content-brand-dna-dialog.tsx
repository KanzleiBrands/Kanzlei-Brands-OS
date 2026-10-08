"use client";

import { useState } from "react";
import { Settings2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ContentBrandDnaForm } from "./content-brand-dna";

/**
 * Dialog-Variante von ContentBrandDnaForm für Orte ohne eigenen
 * Einstellungen-Tab (z.B. internes Marketing-Center) - im Kundenbereich
 * lebt die Marken-DNA stattdessen in den Kundeneinstellungen
 * (settings-tab.tsx, Unterreiter "Kundenboard & Hub").
 */
export function ContentBrandDnaDialog({ organizationId, value }: { organizationId: string; value: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <Settings2Icon className="size-4" />
        Marken-DNA
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Marken-DNA für KI-Ideen-Generierung</DialogTitle>
          <DialogDescription>
            Angebot, Zielgruppe, Tonalität, Positionierung, Alleinstellungsmerkmale... - wird bei jeder KI-Ideen- und
            Texterstellung berücksichtigt.
          </DialogDescription>
        </DialogHeader>
        <ContentBrandDnaForm organizationId={organizationId} value={value} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
