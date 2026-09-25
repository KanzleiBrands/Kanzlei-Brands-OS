"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendInboxReply } from "@/lib/actions/inbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

export function ReplyForm({ contactId, defaultSubject }: { contactId: string; defaultSubject: string }) {
  const [error, formAction, isPending] = useActionState(sendInboxReply, undefined);
  useSaveToast(error, isPending, "Antwort gesendet.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} key={contactId} className="flex flex-col gap-2 border-t bg-card p-4">
      <input type="hidden" name="contactId" value={contactId} />
      <Input name="subject" placeholder="Betreff" defaultValue={defaultSubject} required />
      <textarea
        name="text"
        placeholder="Nachricht..."
        required
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="self-end">
        {isPending ? "Wird gesendet..." : "Antworten"}
      </Button>
    </form>
  );
}
