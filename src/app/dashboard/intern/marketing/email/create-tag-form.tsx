"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMarketingTag } from "@/lib/actions/marketing-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";
import { ABSENCE_COLOR_OPTIONS, absenceColorHex } from "@/lib/absence-colors";

export function CreateTagForm({ organizationId }: { organizationId: string }) {
  const [error, formAction, isPending] = useActionState(createMarketingTag, undefined);
  useSaveToast(error, isPending, "Tag angelegt.");
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
        <label className="text-xs text-muted-foreground">Tag-Name</label>
        <Input name="name" placeholder="z.B. A-Mandant" className="w-56" required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Farbe</label>
        <div className="flex gap-1">
          {ABSENCE_COLOR_OPTIONS.map((color, index) => (
            <label key={color} className="cursor-pointer">
              <input type="radio" name="color" value={color} defaultChecked={index === 0} className="peer sr-only" />
              <span
                className="block size-6 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-foreground"
                style={{ backgroundColor: absenceColorHex(color) }}
              />
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Wird angelegt..." : "Tag anlegen"}
      </Button>
    </form>
  );
}
