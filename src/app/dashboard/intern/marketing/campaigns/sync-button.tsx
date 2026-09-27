"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon } from "lucide-react";
import { runCloseAttributionSync } from "@/lib/actions/attribution";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      try {
        const result = await runCloseAttributionSync();
        if (result.ok) {
          const message = `${result.leadsProcessed} Leads synchronisiert (${result.dealsProcessed} Deals, ${result.leadsSkippedNoEmail} ohne E-Mail übersprungen).`;
          setLastResult(message);
          toast.success(message);
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={run}>
        <RefreshCwIcon className={`size-4 ${isPending ? "animate-spin" : ""}`} />
        Jetzt sofort aktualisieren (läuft sonst automatisch alle 15 Min.)
      </Button>
      {lastResult && <p className="text-xs text-muted-foreground">{lastResult}</p>}
    </div>
  );
}
