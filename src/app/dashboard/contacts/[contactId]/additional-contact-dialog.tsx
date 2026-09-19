"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { addAdditionalContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdditionalContactDialog({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(addAdditionalContact, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PlusIcon className="size-4" />
        Kontakt hinzufügen
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Weiteren Kontakt hinzufügen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="contactId" value={contactId} />
          <Input name="name" placeholder="Name" required />
          <Input name="role" placeholder="Rolle (z.B. Geschäftsführer/in)" />
          <Input name="email" type="email" placeholder="E-Mail" />
          <Input name="phone" placeholder="Telefon" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
