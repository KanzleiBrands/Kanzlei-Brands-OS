"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EditContactDialog({
  contactId,
  firstName,
  lastName,
  email,
  phone,
  companyName,
  website,
  address,
  showCompanyFields,
}: {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName?: string | null;
  website?: string | null;
  address?: string | null;
  showCompanyFields?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(updateContact, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setOpen(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PencilIcon className="size-3.5" />
        Bearbeiten
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kontakt bearbeiten</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="contactId" value={contactId} />
          {showCompanyFields && <Input name="companyName" placeholder="Firma (bei B2B)" defaultValue={companyName ?? ""} />}
          <div className="grid grid-cols-2 gap-3">
            <Input name="firstName" placeholder="Vorname" defaultValue={firstName ?? ""} />
            <Input name="lastName" placeholder="Nachname" defaultValue={lastName ?? ""} />
          </div>
          <Input name="email" type="email" placeholder="E-Mail" defaultValue={email ?? ""} />
          <Input name="phone" placeholder="Telefon" defaultValue={phone ?? ""} />
          {showCompanyFields && (
            <>
              <Input name="website" placeholder="Website" defaultValue={website ?? ""} />
              <Input name="address" placeholder="Adresse" defaultValue={address ?? ""} />
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Speichern..." : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
