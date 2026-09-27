"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTellentImportedAbsences } from "@/lib/actions/tellent-import";

export function DeleteImportedAbsencesButton({ absenceTypeName }: { absenceTypeName: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);

  function run() {
    if (!window.confirm(`"${absenceTypeName}"-Sammelanträge aus dem Tellent-Import wirklich löschen (org-weit, alle Jahre)?`)) return;
    startTransition(async () => {
      try {
        const { deleted } = await deleteTellentImportedAbsences(absenceTypeName);
        setDone(deleted);
        toast.success(deleted > 0 ? `${deleted} Sammelanträge gelöscht.` : "Keine passenden Sammelanträge gefunden.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={run} className="w-fit">
        <Trash2Icon className="size-4" />
        &quot;{absenceTypeName}&quot;-Sammelanträge löschen
      </Button>
      {done !== null && <p className="text-xs text-muted-foreground">{done} Anträge entfernt.</p>}
    </div>
  );
}
