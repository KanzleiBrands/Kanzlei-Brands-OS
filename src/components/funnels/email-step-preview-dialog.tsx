"use client";

import { useMemo, useState } from "react";
import { EyeIcon } from "lucide-react";
import { renderFunnelStepPreview } from "@/lib/funnels/render";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Feste Beispieldaten statt eines echten Kontakts - die Vorschau ist
// unabhängig davon, ob/welche Kontakte gerade in diesem Funnel eingeschrieben
// sind (relevant für die Kundenansicht, die keinen Kontakt auswählen kann).
const PREVIEW_CONTACT = { firstName: "Max", lastName: "Mustermann", companyName: "Musterfirma GmbH" };

/**
 * Zeigt, wie eine E-Mail-Schritt tatsächlich aussehen würde - mit
 * Beispieldaten statt Tracking-Links (siehe renderFunnelStepPreview).
 * Ohne `label` ein reiner Icon-Button (für die Zeilenansicht, auch in der
 * Kundenansicht sichtbar), mit `label` ein beschrifteter Button (fürs
 * Bearbeiten-Formular).
 */
export function EmailStepPreviewDialog({
  subject,
  preheader,
  bodyText,
  ctaLabel,
  ctaUrl,
  label,
}: {
  subject: string;
  preheader?: string | null;
  bodyText: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rendered = useMemo(
    () =>
      renderFunnelStepPreview({
        step: { subject, bodyText, ctaLabel: ctaLabel ?? null, ctaUrl: ctaUrl ?? null },
        contact: PREVIEW_CONTACT,
      }),
    [subject, bodyText, ctaLabel, ctaUrl],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {label ? (
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <EyeIcon className="size-3.5" />
          {label}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label="Vorschau"
              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
            />
          }
        >
          <EyeIcon className="size-3.5" />
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorschau</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <div>
            <p className="text-xs text-muted-foreground">Betreff</p>
            <p className="text-sm font-medium">{rendered.subject || "(ohne Betreff)"}</p>
          </div>
          {preheader && (
            <div>
              <p className="text-xs text-muted-foreground">Preheader</p>
              <p className="text-sm text-muted-foreground">{preheader}</p>
            </div>
          )}
          <div className="rounded-lg border bg-card p-4" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          <p className="text-xs text-muted-foreground">
            Vorschau mit Beispieldaten ({PREVIEW_CONTACT.firstName} {PREVIEW_CONTACT.lastName}, {PREVIEW_CONTACT.companyName}) - Links
            sind hier nicht klickbar/getrackt.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
