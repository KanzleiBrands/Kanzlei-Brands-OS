"use client";

import { useActionState } from "react";
import { createPipeline } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";

export function NewPipelineForm({
  organizationId,
  templates,
}: {
  organizationId: string;
  templates: { id: string; name: string }[];
}) {
  const [error, formAction, isPending] = useActionState(createPipeline, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <Input name="name" placeholder="Kampagnen-Name (z.B. Kampagne X)" required className="max-w-xs" />
      <Select name="kind" defaultValue="LEADS">
        <SelectTrigger className="w-44">
          <SelectValue>{(value: string) => CAMPAIGN_KIND_LABELS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="LEADS">{CAMPAIGN_KIND_LABELS.LEADS}</SelectItem>
          <SelectItem value="APPLICANTS">{CAMPAIGN_KIND_LABELS.APPLICANTS}</SelectItem>
        </SelectContent>
      </Select>
      <Select name="templateId" defaultValue={templates[0]?.id}>
        <SelectTrigger className="w-48">
          <SelectValue>{(value: string) => templates.find((t) => t.id === value)?.name ?? "Statusvorlage"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending || templates.length === 0}>
        {isPending ? "Wird angelegt..." : "Kampagne anlegen"}
      </Button>
      {templates.length === 0 && (
        <p className="w-full text-sm text-destructive">
          Noch keine Statusvorlage vorhanden. Lege zuerst eine in den Einstellungen an.
        </p>
      )}
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
