"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateContactCompanyInfo } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

export function CompanyInfoForm({
  contactId,
  website,
  address,
}: {
  contactId: string;
  website: string | null;
  address: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(updateContactCompanyInfo, undefined);
  useSaveToast(error, isPending);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setEditing(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="contactId" value={contactId} />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Webseite</span>
          <Input key={website} name="website" placeholder="https://..." defaultValue={website ?? ""} autoFocus />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Adresse</span>
          <Input key={address} name="address" placeholder="Straße, PLZ Ort" defaultValue={address ?? ""} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Speichern..." : "Speichern"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Abbrechen
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Webseite</span>
        {website ? (
          <a href={website} target="_blank" rel="noreferrer" className="text-primary underline">
            {website}
          </a>
        ) : (
          <span>-</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Adresse</span>
        <span>{address ?? "-"}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 self-start"
        onClick={() => setEditing(true)}
      >
        <PencilIcon className="size-3.5" />
        Bearbeiten
      </Button>
    </div>
  );
}
