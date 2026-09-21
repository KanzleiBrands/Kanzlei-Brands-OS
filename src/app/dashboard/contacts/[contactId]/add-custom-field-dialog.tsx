"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { setCustomField } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

export function AddCustomFieldDialog({ contactId, pipelineKind }: { contactId: string; pipelineKind: string }) {
  const examplePlaceholder =
    pipelineKind === "APPLICANTS" ? "Feldname (z.B. Gehaltsvorstellung)" : "Feldname (z.B. Jahresumsatz)";
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(setCustomField, undefined);
  useSaveToast(error, isPending);
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
        Feld hinzufügen
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Feld hinzufügen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="contactId" value={contactId} />
          <Input name="key" placeholder={examplePlaceholder} required />
          <Input name="value" placeholder="Wert" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
