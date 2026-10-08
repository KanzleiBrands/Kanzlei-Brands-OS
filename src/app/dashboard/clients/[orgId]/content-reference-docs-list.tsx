"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { addContentReferenceDoc, deleteContentReferenceDoc } from "@/lib/actions/content-reference-docs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveToast } from "@/hooks/use-save-toast";

export type ContentReferenceDocItem = { id: string; label: string; url: string };

/**
 * Wachsende Liste von Referenzlinks (Kunden-Onboarding-Formular, Stellen-
 * Onboardings, Mandatsakquise-Briefings, Fireflies-Transkripte aus Content-
 * Interviews etc.) - v1 speichert bewusst nur den Link als menschliche
 * Referenz, siehe ContentReferenceDoc in schema.prisma. Fließt NICHT
 * automatisch in die KI-Generierung ein (das bleibt die Marken-DNA).
 */
export function ContentReferenceDocsList({
  organizationId,
  docs,
}: {
  organizationId: string;
  docs: ContentReferenceDocItem[];
}) {
  const [error, formAction, isPending] = useActionState(addContentReferenceDoc, undefined);
  useSaveToast(error, isPending, "Dokument hinzugefügt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startDeleteTransition(() => deleteContentReferenceDoc(fd));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Links zu Kunden-Onboarding-Formular, Stellen-Onboardings, Mandatsakquise-Briefings oder Fireflies-Transkripten
        aus Content-Interviews - werden nur als Referenz abgelegt, nicht automatisch ausgelesen.
      </p>

      {docs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate hover:underline"
              >
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.label}</span>
              </a>
              <button
                type="button"
                aria-label="Entfernen"
                disabled={isDeleting}
                onClick={() => handleDelete(doc.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="content-ref-label">Bezeichnung</Label>
          <Input id="content-ref-label" name="label" placeholder="z.B. Fireflies-Transkript Content-Interview 08.10." required />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="content-ref-url">Link (Google Docs, Fireflies, ...)</Label>
          <Input id="content-ref-url" name="url" type="url" placeholder="https://..." required />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
