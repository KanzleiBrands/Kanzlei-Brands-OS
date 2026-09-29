"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getDuplicateCandidates, mergeContacts, type MergeCandidateContact, type MergeField } from "@/lib/actions/contact-merge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const FIELD_LABELS: Record<MergeField, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  email: "E-Mail",
  phone: "Telefon",
  companyName: "Firma",
  website: "Website",
  address: "Adresse",
  location: "Ort",
  cvUrl: "Lebenslauf",
};

function candidateName(c: MergeCandidateContact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.companyName || c.email || c.phone || "Unbenannt";
}

function ContactColumn({
  contact,
  isPrimary,
  onSetPrimary,
}: {
  contact: MergeCandidateContact;
  isPrimary: boolean;
  onSetPrimary: () => void;
}) {
  return (
    <div className={`rounded-lg border p-3 ${isPrimary ? "border-primary bg-primary/5" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{candidateName(contact)}</p>
          <p className="text-xs text-muted-foreground">
            Stufe {contact.stageName} · seit {new Date(contact.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        </div>
        <Button type="button" size="sm" variant={isPrimary ? "default" : "outline"} onClick={onSetPrimary} className="shrink-0">
          {isPrimary ? "Hauptkontakt" : "Als Hauptkontakt"}
        </Button>
      </div>
    </div>
  );
}

function CompareView({
  a,
  b,
  onDone,
}: {
  a: MergeCandidateContact;
  b: MergeCandidateContact;
  onDone: () => void;
}) {
  // Standard: der ältere Kontakt (früher angelegt) bleibt erhalten - meist
  // der, an dem schon Notizen/Aktivität hängt - der Nutzer kann das umkehren.
  const [primaryId, setPrimaryId] = useState(() => (new Date(a.createdAt) <= new Date(b.createdAt) ? a.id : b.id));
  const otherId = primaryId === a.id ? b.id : a.id;

  // Feld-Vergleich zeigt a immer links, b immer rechts - genau wie die
  // Kontakt-Karten oben - unabhängig davon, welcher der beiden gerade als
  // Hauptkontakt markiert ist. Würde man hier stattdessen primary/other
  // verwenden, würden beim Umschalten des Hauptkontakts die Werte
  // scheinbar die Spalte wechseln (bzw. "verschwinden"), obwohl sich an
  // der eigentlichen Auswahl nichts geändert hat - das war die Ursache der
  // ursprünglichen Verwirrung.
  const fieldSource = useMemo(() => {
    const initial: Record<MergeField, string> = {} as Record<MergeField, string>;
    for (const field of Object.keys(FIELD_LABELS) as MergeField[]) {
      const primaryValue = primaryId === a.id ? a[field] : b[field];
      initial[field] = primaryValue ? primaryId : otherId;
    }
    return initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, b.id]);

  const [fieldChoice, setFieldChoice] = useState<Record<MergeField, string>>(fieldSource);
  const [error, formAction, isPending] = useActionState(mergeContacts, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      toast.success("Duplikate zusammengeführt.");
      onDone();
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, error]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="keepContactId" value={primaryId} />
      <input type="hidden" name="mergeContactId" value={otherId} />
      {(Object.keys(FIELD_LABELS) as MergeField[]).map((field) => (
        <input key={field} type="hidden" name={`field_${field}`} value={fieldChoice[field] === primaryId ? "keep" : "merge"} />
      ))}

      <div className="grid grid-cols-2 gap-2">
        <ContactColumn contact={a} isPrimary={primaryId === a.id} onSetPrimary={() => setPrimaryId(a.id)} />
        <ContactColumn contact={b} isPrimary={primaryId === b.id} onSetPrimary={() => setPrimaryId(b.id)} />
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border p-2">
        {(Object.keys(FIELD_LABELS) as MergeField[]).map((field) => {
          const aValue = a[field];
          const bValue = b[field];
          if (!aValue && !bValue) return null;
          return (
            <div key={field} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">{FIELD_LABELS[field]}</span>
              <label
                className={`flex cursor-pointer items-center gap-1.5 truncate rounded-md border px-2 py-1 ${
                  fieldChoice[field] === a.id ? "border-primary bg-primary/5" : "text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name={`choice-${field}`}
                  className="shrink-0"
                  checked={fieldChoice[field] === a.id}
                  onChange={() => setFieldChoice((prev) => ({ ...prev, [field]: a.id }))}
                  disabled={!aValue}
                />
                <span className="truncate">{aValue || "–"}</span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-1.5 truncate rounded-md border px-2 py-1 ${
                  fieldChoice[field] === b.id ? "border-primary bg-primary/5" : "text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name={`choice-${field}`}
                  className="shrink-0"
                  checked={fieldChoice[field] === b.id}
                  onChange={() => setFieldChoice((prev) => ({ ...prev, [field]: b.id }))}
                  disabled={!bValue}
                />
                <span className="truncate">{bValue || "–"}</span>
              </label>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Notizen, Aktivitäten, Aufgaben, E-Mails und Zusatzfelder beider Kontakte werden zusammengeführt - der andere Kontakt wird
        danach gelöscht.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird zusammengeführt..." : "Zusammenführen"}
        </Button>
      </div>
    </form>
  );
}

export function MergeDuplicatesDialog({ contactId, contactName, label }: { contactId: string; contactName: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; contact: MergeCandidateContact; candidates: MergeCandidateContact[] }
  >({ status: "loading" });
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setState({ status: "loading" });
    setSelectedCandidateId(null);
    getDuplicateCandidates(contactId).then((result) => {
      if (!result.ok) setState({ status: "error", message: result.error });
      else setState({ status: "loaded", contact: result.contact, candidates: result.candidates });
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-500 hover:bg-amber-500/20"
            title="Mögliches Duplikat vergleichen und zusammenführen"
          />
        }
      >
        {label ?? "⚠ Mögliches Duplikat"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Duplikat vergleichen - {contactName}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto">
          {state.status === "loading" && <p className="text-sm text-muted-foreground">Lädt...</p>}
          {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
          {state.status === "loaded" && state.candidates.length === 0 && (
            <p className="text-sm text-muted-foreground">Kein Duplikat mehr gefunden - vermutlich wurde es bereits bereinigt.</p>
          )}
          {state.status === "loaded" && state.candidates.length === 1 && (
            <CompareView a={state.contact} b={state.candidates[0]} onDone={() => setOpen(false)} />
          )}
          {state.status === "loaded" && state.candidates.length > 1 && !selectedCandidateId && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Mehrere mögliche Duplikate gefunden - womit vergleichen?</p>
              {state.candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCandidateId(c.id)}
                  className="flex flex-col items-start rounded-lg border p-2.5 text-left text-sm hover:border-primary"
                >
                  <span className="font-medium">{candidateName(c)}</span>
                  <span className="text-xs text-muted-foreground">{c.email ?? c.phone ?? "–"} · Stufe {c.stageName}</span>
                </button>
              ))}
            </div>
          )}
          {state.status === "loaded" && state.candidates.length > 1 && selectedCandidateId && (
            <CompareView
              a={state.contact}
              b={state.candidates.find((c) => c.id === selectedCandidateId)!}
              onDone={() => setOpen(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
