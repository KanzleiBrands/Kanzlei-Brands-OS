"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { createPartnerAction, updatePartnerAction } from "@/lib/actions/partner-program";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

type PartnerActionData = {
  id: string;
  title: string;
  description: string | null;
  ctaLabel: string;
  ctaType: "LINK" | "ACCOUNT_MANAGER_REQUEST";
  ctaUrl: string | null;
  points: number;
};

export function PartnerActionFormDialog({ action }: { action?: PartnerActionData }) {
  const isEdit = !!action;
  const [open, setOpen] = useState(false);
  const [ctaType, setCtaType] = useState<"LINK" | "ACCOUNT_MANAGER_REQUEST">(action?.ctaType ?? "LINK");
  const [error, formAction, isPending] = useActionState(isEdit ? updatePartnerAction : createPartnerAction, undefined);
  useSaveToast(error, isPending, isEdit ? "Aktion gespeichert." : "Aktion angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setOpen(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleOpenChange(next: boolean) {
    if (next && !isEdit) {
      formRef.current?.reset();
      setCtaType("LINK");
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          isEdit ? (
            <button type="button" aria-label="Aktion bearbeiten" className="text-muted-foreground hover:text-foreground" />
          ) : (
            <Button type="button" />
          )
        }
      >
        {isEdit ? (
          <PencilIcon className="size-4" />
        ) : (
          <>
            <PlusIcon className="size-4" />
            Aktion anlegen
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Aktion bearbeiten" : "Aktion anlegen"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          {isEdit && <input type="hidden" name="actionId" value={action.id} />}
          <Input name="title" placeholder="Titel, z.B. Google Bewertung" required defaultValue={action?.title} />
          <Textarea name="description" placeholder="Beschreibung" rows={2} defaultValue={action?.description ?? ""} />
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Punkte bei Gutschrift</label>
              <Input name="points" type="number" min={1} defaultValue={action?.points ?? 1} className="w-24" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-muted-foreground">Button-Text</label>
              <Input name="ctaLabel" placeholder="z.B. Google Bewertung abgeben" defaultValue={action?.ctaLabel} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Button-Aktion</label>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="ctaType"
                  value="LINK"
                  checked={ctaType === "LINK"}
                  onChange={() => setCtaType("LINK")}
                  className="peer sr-only"
                />
                <span className="block rounded-md border px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary/10">
                  Externer Link
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="ctaType"
                  value="ACCOUNT_MANAGER_REQUEST"
                  checked={ctaType === "ACCOUNT_MANAGER_REQUEST"}
                  onChange={() => setCtaType("ACCOUNT_MANAGER_REQUEST")}
                  className="peer sr-only"
                />
                <span className="block rounded-md border px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary/10">
                  Anfrage an Account-Manager
                </span>
              </label>
            </div>
          </div>
          {ctaType === "LINK" ? (
            <Input name="ctaUrl" type="url" placeholder="Link (z.B. Google-Bewertungslink, Buchungslink) - optional" defaultValue={action?.ctaUrl ?? ""} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Kein Link nötig - ein Klick auf den Button schickt euch eine Anfrage per E-Mail und Slack, ihr plant die
              Umsetzung dann manuell mit dem Kunden ein.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert..." : isEdit ? "Speichern" : "Aktion anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
