"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { togglePlatformFirefliesSync, triggerFirefliesSyncNow } from "@/lib/actions/fireflies";

/**
 * Status + Steuerung des Fireflies-Syncs (siehe src/lib/actions/fireflies.ts)
 * - agentur-weit statt pro Kunde, deshalb nur im internen Marketing-Center
 * sichtbar (content-config-panel.tsx gated auf socialContentBooked === null).
 */
export function FirefliesSyncPanel({
  enabled,
  lastSyncedAt,
  lastSyncError,
  transcriptCount,
}: {
  enabled: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  transcriptCount: number;
}) {
  const [isToggling, startToggle] = useTransition();
  const [isSyncing, startSync] = useTransition();

  function runSyncNow() {
    startSync(async () => {
      try {
        const result = await triggerFirefliesSyncNow();
        if (result.skipped) toast.error(result.skipped);
        else toast.success(`${result.synced} Transkript(e) synchronisiert${result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ""}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler beim Sync.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2.5 text-sm">
        <Switch
          defaultChecked={enabled}
          disabled={isToggling}
          onCheckedChange={() => startToggle(() => togglePlatformFirefliesSync())}
        />
        Call-Transkripte automatisch aus Fireflies ziehen (Sales Calls, Kunden-Calls etc.)
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isSyncing} onClick={runSyncNow}>
          <RefreshCwIcon className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
          Jetzt synchronisieren
        </Button>
        <p className="text-xs text-muted-foreground">
          {transcriptCount} Transkript(e) gespeichert
          {lastSyncedAt ? ` · zuletzt synchronisiert ${new Date(lastSyncedAt).toLocaleString("de-DE")}` : ""}
        </p>
      </div>
      {lastSyncError && <p className="text-xs text-destructive">Letzter Fehler: {lastSyncError}</p>}
    </div>
  );
}
