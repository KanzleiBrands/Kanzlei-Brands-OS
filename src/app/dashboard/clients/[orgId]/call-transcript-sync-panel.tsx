"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { togglePlatformFirefliesSync, triggerFirefliesSyncNow } from "@/lib/actions/fireflies";
import { toggleCloseCallsSync, triggerCloseCallsSyncNow } from "@/lib/actions/close-calls";

type SyncStatus = { enabled: boolean; lastSyncedAt: string | null; lastSyncError: string | null };

function SourceSyncRow({
  label,
  status,
  onToggle,
  onSyncNow,
}: {
  label: string;
  status: SyncStatus;
  onToggle: () => Promise<void>;
  onSyncNow: () => Promise<{ synced: number; failed: number; skipped?: string }>;
}) {
  const [isToggling, startToggle] = useTransition();
  const [isSyncing, startSync] = useTransition();

  function runSyncNow() {
    startSync(async () => {
      try {
        const result = await onSyncNow();
        if (result.skipped) toast.error(result.skipped);
        else toast.success(`${result.synced} Transkript(e) synchronisiert${result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ""}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unbekannter Fehler beim Sync.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <Switch defaultChecked={status.enabled} disabled={isToggling} onCheckedChange={() => startToggle(onToggle)} />
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isSyncing} onClick={runSyncNow}>
          <RefreshCwIcon className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
          Jetzt synchronisieren
        </Button>
        <p className="text-xs text-muted-foreground">
          {status.lastSyncedAt ? `zuletzt synchronisiert ${new Date(status.lastSyncedAt).toLocaleString("de-DE")}` : "noch nicht synchronisiert"}
        </p>
      </div>
      {status.lastSyncError && <p className="text-xs text-destructive">Letzter Fehler: {status.lastSyncError}</p>}
    </div>
  );
}

/**
 * Status + Steuerung der Call-Transkript-Syncs (Fireflies + Close.io, siehe
 * src/lib/actions/fireflies.ts, close-calls.ts) - agentur-weit statt pro
 * Kunde, deshalb nur im internen Marketing-Center sichtbar
 * (content-config-panel.tsx gated auf socialContentBooked === null).
 */
export function CallTranscriptSyncPanel({
  fireflies,
  close,
  transcriptCount,
}: {
  fireflies: SyncStatus;
  close: SyncStatus;
  transcriptCount: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SourceSyncRow
        label="Call-Transkripte automatisch aus Fireflies ziehen (Sales Calls, Kunden-Calls etc.)"
        status={fireflies}
        onToggle={togglePlatformFirefliesSync}
        onSyncNow={triggerFirefliesSyncNow}
      />
      <SourceSyncRow
        label="Call-Transkripte automatisch aus Close.io ziehen (Cold Calls, Quali-Calls etc. - volle Gespräche nur mit Close „Call Assistant“-Add-on)"
        status={close}
        onToggle={toggleCloseCallsSync}
        onSyncNow={triggerCloseCallsSyncNow}
      />
      <p className="text-xs text-muted-foreground">{transcriptCount} Transkript(e) insgesamt gespeichert.</p>
    </div>
  );
}
