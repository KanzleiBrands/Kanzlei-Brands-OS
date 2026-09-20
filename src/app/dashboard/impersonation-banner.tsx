"use client";

import { useTransition } from "react";
import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({
  realUserName,
  viewingAsName,
  onSwitchBack,
}: {
  realUserName: string;
  viewingAsName: string;
  onSwitchBack: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-shrink-0 flex-col gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-1.5">
        <EyeIcon className="mt-0.5 size-4 flex-shrink-0" />
        <span>
          Kundenansicht: du siehst die Plattform als <strong>{viewingAsName}</strong> ({realUserName} in
          Agentur-Ansicht)
        </span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-amber-950/30 bg-transparent text-amber-950 hover:bg-amber-950/10 sm:flex-shrink-0"
        disabled={isPending}
        onClick={() => startTransition(() => onSwitchBack())}
      >
        Zurück zur Agentur-Ansicht
      </Button>
    </div>
  );
}
