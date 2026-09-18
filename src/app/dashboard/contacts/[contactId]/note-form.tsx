"use client";

import { useActionState } from "react";
import { addNote } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteForm({ contactId }: { contactId: string }) {
  const [error, formAction, isPending] = useActionState(addNote, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <Textarea name="content" placeholder="Notiz hinzufügen..." required />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Speichern..." : "Notiz speichern"}
      </Button>
    </form>
  );
}
