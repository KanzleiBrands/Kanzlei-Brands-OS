"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createAbsenceRequest } from "@/lib/actions/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { useSaveToast } from "@/hooks/use-save-toast";

type AbsenceTypeOption = { id: string; name: string };

export function AbsenceRequestDialog({
  me,
  absenceTypes,
}: {
  me: { name: string; position: string | null; avatarUrl: string | null };
  absenceTypes: AbsenceTypeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createAbsenceRequest, undefined);
  useSaveToast(error, isPending, "Antrag eingereicht.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  const [firstName, ...rest] = me.name.trim().split(/\s+/);
  const lastName = rest.at(-1) ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon className="size-4" />
        Abwesenheit beantragen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Abwesenheitsantrag</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Mitarbeiter</Label>
            <div className="flex items-center gap-3 rounded-lg border border-input px-2.5 py-2">
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt={me.name} className="size-8 rounded-full object-cover" />
              ) : (
                <div
                  className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: avatarColorFor(me.name) }}
                >
                  {initialsOf(firstName ?? null, lastName)}
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{me.name}</p>
                {me.position && <p className="text-xs text-muted-foreground">{me.position}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Art <span className="text-destructive">*</span>
            </Label>
            <Select name="absenceTypeId" required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Zuordnen">
                  {(value: string) => absenceTypes.find((t) => t.id === value)?.name ?? "Zuordnen"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {absenceTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Abwesenheitstage <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input name="startDate" type="date" required aria-label="Anfangsdatum" />
              <span className="text-muted-foreground">→</span>
              <Input name="endDate" type="date" required aria-label="Enddatum" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Kommentar</Label>
            <Textarea id="note" name="note" placeholder="Eine Notiz hinzufügen..." maxLength={140} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Wird eingereicht..." : "Antrag einreichen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
