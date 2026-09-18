"use client";

import { useActionState, useState } from "react";
import { addNote } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteForm({ contactId }: { contactId: string }) {
  const [error, formAction, isPending] = useActionState(addNote, undefined);
  const [type, setType] = useState<"NOTE" | "CALL">("NOTE");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="type" value={type} />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={type === "NOTE" ? "default" : "outline"}
          onClick={() => setType("NOTE")}
        >
          Notiz
        </Button>
        <Button
          type="button"
          size="sm"
          variant={type === "CALL" ? "default" : "outline"}
          onClick={() => setType("CALL")}
        >
          Anruf protokollieren
        </Button>
      </div>
      <Textarea
        name="content"
        placeholder={type === "CALL" ? "Was wurde im Anruf besprochen?" : "Notiz hinzufügen..."}
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Speichern..." : type === "CALL" ? "Anruf speichern" : "Notiz speichern"}
      </Button>
    </form>
  );
}
