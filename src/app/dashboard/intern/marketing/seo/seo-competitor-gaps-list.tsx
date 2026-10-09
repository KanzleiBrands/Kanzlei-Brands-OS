"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, SparklesIcon, XIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addSeoCompetitorDomain,
  removeSeoCompetitorDomain,
  triggerCompetitorGapsSyncNow,
  dismissCompetitorGap,
} from "@/lib/actions/seo-dataforseo";
import { createBlogIdeaFromCompetitorGap } from "@/lib/actions/blog-posts";

export type SeoCompetitorDomainItem = { id: string; domain: string; label: string | null };
export type SeoCompetitorGapItem = {
  id: string;
  competitorDomain: string;
  keyword: string;
  searchVolume: number | null;
  competitorPosition: number | null;
  ourPosition: number | null;
};

function GapRow({ gap }: { gap: SeoCompetitorGapItem }) {
  const [isCreating, startCreating] = useTransition();
  const [isDismissing, startDismissing] = useTransition();

  function handleCreate() {
    startCreating(async () => {
      const fd = new FormData();
      fd.set("gapId", gap.id);
      const result = await createBlogIdeaFromCompetitorGap(fd);
      if (result?.error) toast.error(result.error);
      else toast.success("Idee erstellt.");
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{gap.keyword}</p>
        <p className="text-xs text-muted-foreground">
          {gap.competitorDomain} rankt auf Position {gap.competitorPosition ?? "?"}
          {gap.ourPosition != null ? ` · wir auf Position ${gap.ourPosition}` : " · wir ranken dafür nicht"}
          {gap.searchVolume != null && ` · ca. ${gap.searchVolume} Suchanfragen/Monat`}
        </p>
      </div>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={isCreating} onClick={handleCreate}>
          <SparklesIcon className="size-4" />
          Idee daraus erstellen
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={isDismissing}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", gap.id);
            startDismissing(() => dismissCompetitorGap(fd));
          }}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Konkurrenz-Keyword-Vergleich via DataForSEO (siehe seo-dataforseo.ts) -
 * Ergänzung zu den GSC-basierten Content-Lücken (die nur zeigen, wo WIR schon
 * fast ranken): hier geht es darum, wofür andere Kanzleien gefunden werden,
 * wir aber nicht.
 */
export function SeoCompetitorGapsList({
  domains,
  gaps,
}: {
  domains: SeoCompetitorDomainItem[];
  gaps: SeoCompetitorGapItem[];
}) {
  const [isAdding, startAdding] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");

  function handleAdd() {
    if (!domain.trim()) return;
    const fd = new FormData();
    fd.set("domain", domain.trim());
    fd.set("label", label.trim());
    startAdding(async () => {
      await addSeoCompetitorDomain(fd);
      setDomain("");
      setLabel("");
    });
  }

  function handleSync() {
    startSyncing(async () => {
      const result = await triggerCompetitorGapsSyncNow();
      if (result.error) toast.error(result.error);
      else toast.success(`${result.found} Keyword(s) verglichen.`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm font-medium">Konkurrenz-Domains</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Domain</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="z.B. andere-kanzlei.de" className="w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Bezeichnung (optional)</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Hauptkonkurrent" className="w-48" />
          </div>
          <Button type="button" size="sm" disabled={isAdding || !domain.trim()} onClick={handleAdd}>
            <PlusIcon className="size-4" />
            Hinzufügen
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isSyncing || domains.length === 0} onClick={handleSync}>
            <RefreshCwIcon className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
            Jetzt vergleichen
          </Button>
        </div>

        {domains.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {domains.map((d) => (
              <span key={d.id} className="flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-1 text-xs">
                {d.label ? `${d.label} (${d.domain})` : d.domain}
                <button
                  type="button"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", d.id);
                    removeSeoCompetitorDomain(fd);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Konkurrenz-Keyword-Lücken gefunden (Domains hinzufügen und auf &quot;Jetzt vergleichen&quot; klicken).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {gaps.map((gap) => (
            <GapRow key={gap.id} gap={gap} />
          ))}
        </div>
      )}
    </div>
  );
}
