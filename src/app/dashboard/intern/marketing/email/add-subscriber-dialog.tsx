"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createSubscriber } from "@/lib/actions/marketing-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

const NONE = "__none__";

export function AddSubscriberDialog({
  organizationId,
  tags,
}: {
  organizationId: string;
  tags: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createSubscriber, undefined);
  useSaveToast(error, isPending, "Kontakt hinzugefügt.");
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
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon className="size-4" />
        Kontakt anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kontakt anlegen</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="flex flex-col gap-1">
            <Label htmlFor="subscriber-email">E-Mail</Label>
            <Input id="subscriber-email" name="email" type="email" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="subscriber-firstname">Vorname</Label>
              <Input id="subscriber-firstname" name="firstName" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="subscriber-lastname">Nachname</Label>
              <Input id="subscriber-lastname" name="lastName" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="subscriber-phone">Telefon (optional)</Label>
            <Input id="subscriber-phone" name="phone" />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>Tag (optional)</Label>
              <Select name="tagId" defaultValue={NONE}>
                <SelectTrigger>
                  <SelectValue>{(value: string) => (value === NONE ? "Kein Tag" : tags.find((t) => t.id === value)?.name)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein Tag</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
