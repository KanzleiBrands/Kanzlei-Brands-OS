"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMarketingFunnel } from "@/lib/actions/marketing-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveToast } from "@/hooks/use-save-toast";

const NONE = "__none__";

export function CreateFunnelForm({ organizationId, tags }: { organizationId: string; tags: { id: string; name: string }[] }) {
  const [error, formAction, isPending] = useActionState(createMarketingFunnel, undefined);
  useSaveToast(error, isPending, "Funnel angelegt.");
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Funnel-Name</label>
        <Input name="name" placeholder="z.B. A-Mandanten Willkommens-Funnel" className="w-64" required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Trigger-Tag (optional)</label>
        <Select name="triggerTagId" defaultValue={NONE}>
          <SelectTrigger className="w-56">
            <SelectValue>{(value: string) => (value === NONE ? "Nur manuell" : tags.find((t) => t.id === value)?.name)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nur manuell</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Funnel anlegen"}
      </Button>
    </form>
  );
}
