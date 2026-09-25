"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SendIcon } from "lucide-react";
import { sendInboxReply } from "@/lib/actions/inbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

export function ReplyForm({ contactId, defaultSubject }: { contactId: string; defaultSubject: string }) {
  const [error, formAction, isPending] = useActionState(sendInboxReply, undefined);
  useSaveToast(error, isPending, "Antwort gesendet.");
  const [expanded, setExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setExpanded(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  useEffect(() => {
    if (expanded) textareaRef.current?.focus();
  }, [expanded]);

  if (!expanded) {
    return (
      <div className="border-t bg-card/60 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 rounded-full border bg-background px-4 py-2.5 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Antworten&hellip;
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-t bg-card/60 p-3 sm:p-4">
      <input type="hidden" name="contactId" value={contactId} />
      <Input name="subject" placeholder="Betreff" defaultValue={defaultSubject} required />
      <Textarea ref={textareaRef} name="text" placeholder="Nachricht..." required rows={4} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setExpanded(false)} disabled={isPending}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isPending} className="gap-1.5">
          <SendIcon className="size-3.5" />
          {isPending ? "Wird gesendet..." : "Antworten"}
        </Button>
      </div>
    </form>
  );
}
