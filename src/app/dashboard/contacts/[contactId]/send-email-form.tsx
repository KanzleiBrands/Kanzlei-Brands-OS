"use client";

import { useActionState, useRef, useState } from "react";
import { sendEmailToContact } from "@/lib/actions/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Template = { id: string; name: string; subject: string | null; body: string };

export function SendEmailForm({
  contactId,
  hasMailbox,
  templates = [],
}: {
  contactId: string;
  hasMailbox: boolean;
  templates?: Template[];
}) {
  const [error, formAction, isPending] = useActionState(sendEmailToContact, undefined);
  const [templateId, setTemplateId] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  if (!hasMailbox) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein E-Mail-Postfach verbunden. Verbinde eines unter{" "}
        <a href="/dashboard/settings?tab=mailbox" className="underline">
          Postfach
        </a>
        , um E-Mails direkt aus der Plattform zu senden.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      {templates.length > 0 && (
        <Select
          value={templateId}
          onValueChange={(id) => {
            const template = templates.find((t) => t.id === id);
            if (template) {
              if (subjectRef.current) subjectRef.current.value = template.subject ?? "";
              if (textRef.current) textRef.current.value = template.body;
            }
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
      <Input ref={subjectRef} name="subject" placeholder="Betreff" required />
      <Textarea ref={textRef} name="text" placeholder="Nachricht..." required rows={4} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Wird gesendet..." : "E-Mail senden"}
      </Button>
    </form>
  );
}
