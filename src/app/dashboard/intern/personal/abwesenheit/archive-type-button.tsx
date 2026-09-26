"use client";

import { useTransition } from "react";
import { ArchiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveAbsenceType } from "@/lib/actions/hr";
import { useSaveToast } from "@/hooks/use-save-toast";

export function ArchiveTypeButton({ typeId }: { typeId: string }) {
  const [isPending, startTransition] = useTransition();
  useSaveToast(undefined, isPending, "Archiviert.");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => { await archiveAbsenceType(typeId); })}
    >
      <ArchiveIcon className="size-3.5" />
      Archivieren
    </Button>
  );
}
