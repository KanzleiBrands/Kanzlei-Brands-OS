"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { renamePipeline } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EditPipelineNameForm({ pipelineId, name }: { pipelineId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(renamePipeline, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setEditing(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  if (!editing) {
    return (
      <p className="flex items-center gap-2 text-sm">
        {name}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Kampagnennamen bearbeiten"
          className="text-muted-foreground hover:text-foreground"
        >
          <PencilIcon className="size-3.5" />
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <Input key={name} name="name" defaultValue={name} required autoFocus className="max-w-xs" />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Speichern..." : "Speichern"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
        Abbrechen
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
