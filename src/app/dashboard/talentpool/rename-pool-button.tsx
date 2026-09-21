"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { renameTalentPool } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RenamePoolButton({ poolId, currentName }: { poolId: string; currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Pool umbenennen">
        <PencilIcon className="size-3.5" />
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await renameTalentPool(formData);
        toast.success("Gespeichert.");
        setEditing(false);
      }}
      className="flex items-center gap-1.5"
    >
      <input type="hidden" name="poolId" value={poolId} />
      <Input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-48"
        autoFocus
        onBlur={() => {
          if (!name.trim()) setEditing(false);
        }}
      />
      <Button type="submit" size="sm">
        Speichern
      </Button>
    </form>
  );
}
