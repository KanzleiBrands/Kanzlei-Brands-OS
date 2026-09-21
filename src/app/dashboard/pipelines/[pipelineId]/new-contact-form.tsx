"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveToast } from "@/hooks/use-save-toast";

export function NewContactForm({
  pipelineId,
  pipelineKind,
  stages,
}: {
  pipelineId: string;
  pipelineKind: string;
  stages: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(createContact, undefined);
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
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon className="size-4" />
        Kontakt anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kontakt anlegen</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="pipelineId" value={pipelineId} />
          {pipelineKind === "LEADS" && <Input name="companyName" placeholder="Firma (bei B2B)" />}
          <div className="grid grid-cols-2 gap-3">
            <Input name="firstName" placeholder="Vorname" />
            <Input name="lastName" placeholder="Nachname" />
          </div>
          <Input name="email" type="email" placeholder="E-Mail" />
          <Input name="phone" placeholder="Telefon" />
          <Select name="stageId" defaultValue={stages[0]?.id}>
            <SelectTrigger>
              <SelectValue>{(value: string) => stages.find((s) => s.id === value)?.name ?? "Status"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird angelegt..." : "Kontakt anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
