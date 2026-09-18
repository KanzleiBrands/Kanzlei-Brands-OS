"use client";

import { useActionState } from "react";
import { createPipeline } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewPipelineForm({ organizationId }: { organizationId: string }) {
  const [error, formAction, isPending] = useActionState(createPipeline, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <Input name="name" placeholder="Pipeline-Name (z.B. Kampagne X)" required className="max-w-xs" />
      <Select name="kind" defaultValue="LEADS">
        <SelectTrigger className="w-40">
          <SelectValue>
            {(value: string) => (value === "APPLICANTS" ? "Bewerber (ATS)" : "Leads (CRM)")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="LEADS">Leads (CRM)</SelectItem>
          <SelectItem value="APPLICANTS">Bewerber (ATS)</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Pipeline anlegen"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
