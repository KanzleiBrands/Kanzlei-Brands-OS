"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createOffer } from "@/lib/actions/offers";
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

export function NewOfferForm() {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createOffer, undefined);
  useSaveToast(error, isPending, "Angebot angelegt.");
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
      <DialogTrigger render={<Button type="button" />}>
        <PlusIcon className="size-4" />
        Angebot anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Angebot anlegen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Input name="title" placeholder="Titel" required />
          <Input name="description" placeholder="Beschreibung" />
          <Input name="ctaLabel" placeholder="Button-Text (Standard: Interesse)" />
          <Input name="productTag" placeholder="Produkt-Tag, z.B. webseite (optional)" />
          <p className="text-sm text-muted-foreground">
            Kunden, bei denen dieser Tag unter &bdquo;Bereits gebuchte Produkte&ldquo; hinterlegt ist, sehen dieses
            Angebot nicht.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Angebot anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
