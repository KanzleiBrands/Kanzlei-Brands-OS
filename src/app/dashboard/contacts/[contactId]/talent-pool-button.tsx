"use client";

import { useState } from "react";
import { StarIcon } from "lucide-react";
import { setTalentPool } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TalentPoolButton({
  contactId,
  talentPool,
  talentPoolNote,
}: {
  contactId: string;
  talentPool: boolean;
  talentPoolNote: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (talentPool) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <StarIcon className="size-3" />
          Talentpool
        </Badge>
        {talentPoolNote && <span className="text-sm text-muted-foreground">{talentPoolNote}</span>}
        <form action={setTalentPool}>
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="enabled" value="false" />
          <Button type="submit" size="sm" variant="ghost">
            Aus Talentpool entfernen
          </Button>
        </form>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <StarIcon className="size-4" />
        Zum Talentpool hinzufügen
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Zum Talentpool hinzufügen</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await setTalentPool(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="enabled" value="true" />
          <p className="text-sm text-muted-foreground">
            Passt aktuell nicht, ist aber grundsätzlich interessant? Wir legen automatisch eine Wiedervorlage in ca.
            6 Monaten an, um noch mal nachzufassen.
          </p>
          <Textarea name="note" placeholder="Notiz (optional), z.B. wofür der Kandidat gut passen könnte" />
          <Button type="submit">Hinzufügen</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
