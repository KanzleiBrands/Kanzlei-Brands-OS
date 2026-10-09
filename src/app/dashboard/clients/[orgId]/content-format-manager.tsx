"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { createContentFormat, updateContentFormat, deleteContentFormat } from "@/lib/actions/content-formats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleTextarea } from "@/components/collapsible-textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

export type ContentFormatItem = { id: string; name: string; description: string; examples: string };

function FormatForm({ format, onDone }: { format?: ContentFormatItem; onDone: () => void }) {
  const isEdit = !!format;
  const [error, formAction, isPending] = useActionState(isEdit ? updateContentFormat : createContentFormat, undefined);
  useSaveToast(error, isPending, isEdit ? "Copywriting-Framework gespeichert." : "Copywriting-Framework angelegt.");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) onDone();
    wasPending.current = isPending;
  }, [isPending, error, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {isEdit && <input type="hidden" name="id" value={format.id} />}
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-name">Name</Label>
        <Input id="cf-name" name="name" defaultValue={format?.name ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-description">Anleitung (Struktur/Vorgehen für die KI)</Label>
        <CollapsibleTextarea id="cf-description" name="description" collapsedRows={3} expandedRows={14} defaultValue={format?.description ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-examples">Beispiel(e)</Label>
        <CollapsibleTextarea id="cf-examples" name="examples" collapsedRows={3} expandedRows={14} defaultValue={format?.examples ?? ""} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-1.5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert..." : isEdit ? "Speichern" : "Anlegen"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

type ManagerMode = { kind: "list" } | { kind: "create" } | { kind: "edit"; format: ContentFormatItem };

/**
 * Agenturweite Verwaltung der Format-Bibliothek (siehe src/lib/actions/content-formats.ts),
 * die die KI-Ideen-Generierung (content-ideas.ts) speist - Anlegen/Bearbeiten/Löschen ist
 * serverseitig auf Agentur-Admins beschränkt (requireAgencyAdmin).
 */
export function ContentFormatManager({ formats }: { formats: ContentFormatItem[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ManagerMode>({ kind: "list" });
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setMode({ kind: "list" });
  }

  function handleDelete(id: string) {
    if (
      !window.confirm(
        "Copywriting-Framework wirklich löschen? Beiträge, die es nutzen, behalten ihren Text, verlieren aber die Zuordnung.",
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => deleteContentFormat(fd));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <Settings2Icon className="size-4" />
        Copywriting-Frameworks verwalten
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copywriting-Framework-Bibliothek</DialogTitle>
          <DialogDescription>
            Agenturweite Copywriting-Frameworks für die KI-Ideen-Generierung - Anleitung und Beispiel steuern, wie die
            KI Ideen und Texte in diesem Framework erstellt.
          </DialogDescription>
        </DialogHeader>

        {mode.kind === "list" && (
          <div className="flex flex-col gap-2">
            <Button type="button" size="sm" onClick={() => setMode({ kind: "create" })}>
              <PlusIcon className="size-4" />
              Neues Copywriting-Framework
            </Button>
            <div className="flex flex-col gap-1.5">
              {formats.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                  <button
                    type="button"
                    aria-label="Bearbeiten"
                    onClick={() => setMode({ kind: "edit", format: f })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Löschen"
                    disabled={isPending}
                    onClick={() => handleDelete(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              ))}
              {formats.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Copywriting-Frameworks angelegt.</p>}
            </div>
          </div>
        )}
        {mode.kind === "create" && <FormatForm onDone={() => setMode({ kind: "list" })} />}
        {mode.kind === "edit" && <FormatForm format={mode.format} onDone={() => setMode({ kind: "list" })} />}
      </DialogContent>
    </Dialog>
  );
}
