"use client";

import { useActionState, useRef, useState } from "react";
import { addNote } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Template = { id: string; name: string; body: string };

export function NoteForm({ contactId, templates = [] }: { contactId: string; templates?: Template[] }) {
  const [error, formAction, isPending] = useActionState(addNote, undefined);
  const [type, setType] = useState<"NOTE" | "CALL">("NOTE");
  const [templateId, setTemplateId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-wrap items-center gap-2">
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
        {templates.length > 0 && (
          <Select
            value={templateId}
            onValueChange={(id) => {
              const template = templates.find((t) => t.id === id);
              if (template && textareaRef.current) textareaRef.current.value = template.body;
              setTemplateId("");
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue>{() => "Vorlage einfügen"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <Textarea
        ref={textareaRef}
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
