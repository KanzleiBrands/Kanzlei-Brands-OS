"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { updateUserName } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveToast } from "@/hooks/use-save-toast";

export function EditableUserName({ userId, name }: { userId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(updateUserName, undefined);
  useSaveToast(error, isPending);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) setEditing(false);
    wasPending.current = isPending;
  }, [isPending, error]);

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        {name}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${name} bearbeiten`}
          className="text-muted-foreground hover:text-foreground"
        >
          <PencilIcon className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input key={name} name="name" defaultValue={name} autoFocus className="h-8 max-w-[180px]" />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "..." : "Speichern"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
        Abbrechen
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
