"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideAbsenceRequest } from "@/lib/actions/hr";
import { useSaveToast } from "@/hooks/use-save-toast";

export function DecideRequestButtons({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  useSaveToast(error, isPending, "Entscheidung gespeichert.");

  function decide(decision: "APPROVED" | "DECLINED") {
    startTransition(async () => {
      const result = await decideAbsenceRequest(requestId, decision);
      setError(result);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => decide("DECLINED")}>
        <XIcon className="size-3.5" />
        Ablehnen
      </Button>
      <Button type="button" size="sm" disabled={isPending} onClick={() => decide("APPROVED")}>
        <CheckIcon className="size-3.5" />
        Genehmigen
      </Button>
    </div>
  );
}
