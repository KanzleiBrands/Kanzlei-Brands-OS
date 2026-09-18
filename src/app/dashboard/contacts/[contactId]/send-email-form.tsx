"use client";

import { useActionState } from "react";
import { sendEmailToContact } from "@/lib/actions/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SendEmailForm({ contactId, hasMailbox }: { contactId: string; hasMailbox: boolean }) {
  const [error, formAction, isPending] = useActionState(sendEmailToContact, undefined);

  if (!hasMailbox) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein E-Mail-Postfach verbunden. Verbinde eines unter{" "}
        <a href="/dashboard/mailbox" className="underline">
          Postfach
        </a>
        , um E-Mails direkt aus der Plattform zu senden.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <Input name="subject" placeholder="Betreff" required />
      <Textarea name="text" placeholder="Nachricht..." required rows={4} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Wird gesendet..." : "E-Mail senden"}
      </Button>
    </form>
  );
}
