"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSeoBacklink, deleteSeoBacklink, updateSeoBacklinkStatus } from "@/lib/actions/seo-backlinks";

export type SeoBacklinkItem = {
  id: string;
  domain: string;
  url: string | null;
  status: "GEPLANT" | "ANGEFRAGT" | "LIVE" | "ABGELEHNT";
  note: string | null;
};

const STATUS_OPTIONS: SeoBacklinkItem["status"][] = ["GEPLANT", "ANGEFRAGT", "LIVE", "ABGELEHNT"];
const STATUS_LABELS: Record<SeoBacklinkItem["status"], string> = {
  GEPLANT: "Geplant",
  ANGEFRAGT: "Angefragt",
  LIVE: "Live",
  ABGELEHNT: "Abgelehnt",
};

/**
 * Rein manuelles Backlink-Tracking (siehe SeoBacklink-Modell-Kommentar - es
 * gibt keine kostenlose automatisierte Backlink-Quelle, auch byclaire.co
 * automatisiert echten Linkaufbau nicht). Einfache Liste statt Sync-Ziel.
 */
export function SeoBacklinksList({ backlinks }: { backlinks: SeoBacklinkItem[] }) {
  const [isAdding, startAdding] = useTransition();
  const [domain, setDomain] = useState("");
  const [url, setUrl] = useState("");

  function handleAdd() {
    if (!domain.trim()) return;
    const fd = new FormData();
    fd.set("domain", domain.trim());
    fd.set("url", url.trim());
    startAdding(async () => {
      await createSeoBacklink(fd);
      setDomain("");
      setUrl("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Domain</label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="z.B. fachportal.de" className="w-48" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">URL (optional)</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-64" />
        </div>
        <Button type="button" size="sm" disabled={isAdding || !domain.trim()} onClick={handleAdd}>
          <PlusIcon className="size-4" />
          Hinzufügen
        </Button>
      </div>

      {backlinks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Backlink-Platzierungen getrackt.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {backlinks.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <div className="flex flex-col">
                <p className="text-sm font-medium">{b.domain}</p>
                {b.url && (
                  <a href={b.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
                    {b.url}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  defaultValue={b.status}
                  className="h-7 rounded-md border bg-background px-1.5 text-xs"
                  onChange={(e) => {
                    const fd = new FormData();
                    fd.set("id", b.id);
                    fd.set("status", e.target.value);
                    updateSeoBacklinkStatus(fd);
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", b.id);
                    deleteSeoBacklink(fd);
                  }}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
