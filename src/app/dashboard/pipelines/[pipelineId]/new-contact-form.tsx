"use client";

import { useActionState } from "react";
import { createContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewContactForm({
  pipelineId,
  stages,
}: {
  pipelineId: string;
  stages: { id: string; name: string }[];
}) {
  const [error, formAction, isPending] = useActionState(createContact, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <Input name="firstName" placeholder="Vorname" className="w-32" />
      <Input name="lastName" placeholder="Nachname" className="w-32" />
      <Input name="email" type="email" placeholder="E-Mail" className="w-48" />
      <Input name="phone" placeholder="Telefon" className="w-36" />
      <Select name="stageId" defaultValue={stages[0]?.id}>
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => stages.find((s) => s.id === value)?.name ?? "Stage"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Wird angelegt..." : "Kontakt anlegen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
