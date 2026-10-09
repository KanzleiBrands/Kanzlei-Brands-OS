"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCwIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  updateDataForSeoTargetDomain,
  toggleDataForSeoEnabled,
  triggerSearchVolumeEnrichmentNow,
  triggerBacklinkProfileSyncNow,
} from "@/lib/actions/seo-dataforseo";
import { updateGeoTargetBrandName } from "@/lib/actions/seo-geo";

export type DataForSeoState = {
  configured: boolean;
  enabled: boolean;
  targetDomain: string | null;
  geoTargetBrandName: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

/**
 * DataForSEO-Konfiguration - die bezahlte (nutzungsbasierte) Ergänzung zur
 * kostenlosen GSC-Analyse (siehe gsc-connection-panel.tsx): echtes
 * Suchvolumen, Konkurrenz-Keyword-Vergleich, Backlink-Profil. "enabled"
 * steuert bisher nur, ob ein künftiger automatischer Cron-Lauf diese Daten
 * mitziehen darf - ausgelöst wird hier alles über die "Jetzt"-Buttons, da
 * jeder DataForSEO-Aufruf echtes Geld kostet (siehe .env.example).
 */
export function DataForSeoConfigPanel({ state }: { state: DataForSeoState }) {
  const [domain, setDomain] = useState(state.targetDomain ?? "");
  const [brandName, setBrandName] = useState(state.geoTargetBrandName ?? "");
  const [isSavingDomain, startSavingDomain] = useTransition();
  const [isSavingBrandName, startSavingBrandName] = useTransition();
  const [isToggling, startToggling] = useTransition();
  const [isEnrichingVolume, startEnrichingVolume] = useTransition();
  const [isSyncingBacklinks, startSyncingBacklinks] = useTransition();

  function handleSaveDomain() {
    const fd = new FormData();
    fd.set("domain", domain.trim());
    startSavingDomain(async () => {
      await updateDataForSeoTargetDomain(fd);
      toast.success("Zieldomain gespeichert.");
    });
  }

  function handleSaveBrandName() {
    const fd = new FormData();
    fd.set("brandName", brandName.trim());
    startSavingBrandName(async () => {
      await updateGeoTargetBrandName(fd);
      toast.success("Markenname gespeichert.");
    });
  }

  function handleEnrichVolume() {
    startEnrichingVolume(async () => {
      const result = await triggerSearchVolumeEnrichmentNow();
      if (result.error) toast.error(result.error);
      else toast.success(`${result.enriched} Content-Lücke(n) mit Suchvolumen angereichert.`);
    });
  }

  function handleSyncBacklinks() {
    startSyncingBacklinks(async () => {
      const result = await triggerBacklinkProfileSyncNow();
      if (!result.ok) toast.error(result.error);
      else toast.success("Backlink-Profil aktualisiert.");
    });
  }

  if (!state.configured) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm text-muted-foreground">
          DataForSEO ist noch nicht eingerichtet - ohne diese Zugangsdaten bleibt die Content-Lücken-Analyse rein auf Google Search
          Console beschränkt (kostenlos, aber ohne echtes Suchvolumen, Konkurrenz-Vergleich oder Backlink-Profil).
        </p>
        <p className="text-xs text-muted-foreground">
          Einrichtung: Account unter app.dataforseo.com anlegen, dann DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD in Vercel setzen (siehe
          .env.example).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Eigene Zieldomain</label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="z.B. kanzlei-brands.de" className="w-56" />
        </div>
        <Button type="button" size="sm" variant="outline" disabled={isSavingDomain} onClick={handleSaveDomain}>
          <LinkIcon className="size-4" />
          Speichern
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t pt-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Markenname (für GEO-Sichtbarkeit, z.B. &quot;Kanzlei Brands&quot;)</label>
          <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="z.B. Kanzlei Brands" className="w-56" />
        </div>
        <Button type="button" size="sm" variant="outline" disabled={isSavingBrandName} onClick={handleSaveBrandName}>
          <LinkIcon className="size-4" />
          Speichern
        </Button>
      </div>

      <div className="flex items-center gap-2 border-t pt-2">
        <Switch
          checked={state.enabled}
          disabled={isToggling}
          onCheckedChange={() => startToggling(() => toggleDataForSeoEnabled())}
        />
        <p className="text-sm">Automatisch im täglichen Cron mitlaufen lassen (kostet bei jedem Lauf echtes Geld)</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <Button type="button" size="sm" variant="outline" disabled={isEnrichingVolume || !state.targetDomain} onClick={handleEnrichVolume}>
          <RefreshCwIcon className={`size-4 ${isEnrichingVolume ? "animate-spin" : ""}`} />
          Suchvolumen jetzt anreichern
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSyncingBacklinks || !state.targetDomain}
          onClick={handleSyncBacklinks}
        >
          <RefreshCwIcon className={`size-4 ${isSyncingBacklinks ? "animate-spin" : ""}`} />
          Backlink-Profil jetzt aktualisieren
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {state.lastSyncedAt ? `zuletzt ausgeführt ${new Date(state.lastSyncedAt).toLocaleString("de-DE")}` : "noch nicht ausgeführt"}
      </p>
      {state.lastSyncError && <p className="text-xs text-destructive">Letzter Fehler: {state.lastSyncError}</p>}
    </div>
  );
}
