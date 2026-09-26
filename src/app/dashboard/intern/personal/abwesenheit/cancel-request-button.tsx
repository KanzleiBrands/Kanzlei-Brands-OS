"use client";

import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelAbsenceRequest } from "@/lib/actions/hr";
import { useSaveToast } from "@/hooks/use-save-toast";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending, "Antrag storniert.");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        setError(undefined);
        startTransition(async () => {
          await cancelAbsenceRequest(requestId);
        });
      }}
    >
      <XIcon className="size-3.5" />
      Stornieren
    </Button>
  );
}
