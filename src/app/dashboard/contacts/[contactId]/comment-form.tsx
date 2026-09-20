"use client";

import { useActionState, useEffect, useRef } from "react";
import { postComment } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ contactId }: { contactId: string }) {
  const [error, formAction, isPending] = useActionState(postComment, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <Textarea name="content" placeholder="Kommentar an die Gegenseite..." required />
      <p className="text-sm text-muted-foreground">
        Löst eine E-Mail-Benachrichtigung an die jeweils andere Seite aus (Kunde ↔ Agentur).
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Wird gesendet..." : "Kommentar senden"}
      </Button>
    </form>
  );
}
