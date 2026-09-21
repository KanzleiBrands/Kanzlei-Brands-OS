"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

export function NewTaskForm({ contactId }: { contactId: string }) {
  const [error, formAction, isPending] = useActionState(createTask, undefined);
  useSaveToast(error, isPending, "Aufgabe erstellt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="contactId" value={contactId} />
      <div className="flex-1">
        <label className="mb-1 block text-sm text-muted-foreground">Titel</label>
        <Input name="title" placeholder="z.B. Nachfassen wegen Angebot" required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Fällig am</label>
        <Input name="dueAt" type="date" required className="w-full sm:w-40" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Wiederholen alle (Tage)</label>
        <Input name="repeatIntervalDays" type="number" min={1} placeholder="optional" className="w-full sm:w-32" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Anlegen..." : "Wiedervorlage anlegen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
