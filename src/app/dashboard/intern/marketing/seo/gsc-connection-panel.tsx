"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGscSiteOptions, selectGscSite, disconnectGsc } from "@/lib/actions/seo";
import { triggerSeoGapsSyncNow } from "@/lib/actions/seo-gaps";
import type { GscSite } from "@/lib/google-search-console/client";

type GscState = { connected: boolean; siteUrl: string | null; lastSyncedAt: string | null; lastSyncError: string | null };

/**
 * Google-Search-Console-Verbindung für die kostenlose Content-Lücken-
 * Analyse (siehe seo-gaps.ts) - Connect läuft über einen echten OAuth-
 * Redirect (/api/seo/gsc/connect), kein Server Action möglich dafür. Nach
 * dem Callback (siteUrl noch null) zeigt diese Komponente die Property-
 * Auswahl aus sites.list.
 */
export function GscConnectionPanel({ gsc }: { gsc: GscState }) {
  const [siteOptions, setSiteOptions] = useState<GscSite[] | null>(null);
  const [isLoadingSites, startLoadingSites] = useTransition();
  const [isSelecting, startSelecting] = useTransition();
  const [isDisconnecting, startDisconnecting] = useTransition();
  const [isSyncing, startSyncing] = useTransition();

  useEffect(() => {
    if (gsc.connected && !gsc.siteUrl) {
      startLoadingSites(async () => {
        const result = await getGscSiteOptions();
        if (result.ok) setSiteOptions(result.sites);
        else toast.error(result.error);
      });
    }
  }, [gsc.connected, gsc.siteUrl]);

  function runSyncNow() {
    startSyncing(async () => {
      const result = await triggerSeoGapsSyncNow();
      if (result.skipped) toast.error(result.skipped);
      else toast.success(`${result.found} Content-Lücke(n) gefunden.`);
    });
  }

  if (!gsc.connected) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm text-muted-foreground">
          Noch keine Google-Search-Console-Verbindung - Grundlage für die kostenlose Content-Lücken-Analyse.
        </p>
        <Button type="button" size="sm" render={<a href="/api/seo/gsc/connect" />}>
          Mit Google Search Console verbinden
        </Button>
      </div>
    );
  }

  if (!gsc.siteUrl) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm font-medium">Welche Property soll verwendet werden?</p>
        {isLoadingSites && <p className="text-xs text-muted-foreground">Lade Properties...</p>}
        {siteOptions && siteOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">Keine Properties im verbundenen Google-Account gefunden.</p>
        )}
        {siteOptions?.map((site) => (
          <Button
            key={site.siteUrl}
            type="button"
            size="sm"
            variant="outline"
            disabled={isSelecting}
            onClick={() =>
              startSelecting(async () => {
                const fd = new FormData();
                fd.set("siteUrl", site.siteUrl);
                await selectGscSite(fd);
              })
            }
          >
            {site.siteUrl}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">Verbunden: {gsc.siteUrl}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isSyncing} onClick={runSyncNow}>
          <RefreshCwIcon className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
          Jetzt analysieren
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDisconnecting}
          onClick={() => startDisconnecting(() => disconnectGsc())}
        >
          Trennen
        </Button>
        <p className="text-xs text-muted-foreground">
          {gsc.lastSyncedAt ? `zuletzt analysiert ${new Date(gsc.lastSyncedAt).toLocaleString("de-DE")}` : "noch nicht analysiert"}
        </p>
      </div>
      {gsc.lastSyncError && <p className="text-xs text-destructive">Letzter Fehler: {gsc.lastSyncError}</p>}
    </div>
  );
}
