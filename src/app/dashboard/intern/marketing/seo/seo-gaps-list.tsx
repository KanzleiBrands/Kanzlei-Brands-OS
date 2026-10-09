"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBlogIdeaFromGap } from "@/lib/actions/blog-posts";
import { dismissSeoContentGap } from "@/lib/actions/seo-gaps";

export type SeoContentGapItem = {
  id: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
};

function GapRow({ gap }: { gap: SeoContentGapItem }) {
  const [isCreating, startCreating] = useTransition();
  const [isDismissing, startDismissing] = useTransition();

  function handleCreate() {
    startCreating(async () => {
      const fd = new FormData();
      fd.set("gapId", gap.id);
      const result = await createBlogIdeaFromGap(fd);
      if (result?.error) toast.error(result.error);
      else toast.success("Idee erstellt.");
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{gap.query}</p>
        <p className="text-xs text-muted-foreground">
          Position {gap.avgPosition.toFixed(1)} · {gap.impressions} Impressionen · {gap.clicks} Klicks ·{" "}
          {(gap.ctr * 100).toFixed(1)}% CTR (letzte 28 Tage)
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
            startDismissing(() => dismissSeoContentGap(fd));
          }}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Content-Lücken aus der eigenen Google-Search-Console-Analyse (siehe
 * seo-gaps.ts) - "Striking-Distance"-Suchanfragen, für die es noch keinen
 * guten Beitrag gibt. Ein Klick erstellt daraus direkt eine Blogartikel-Idee.
 */
export function SeoGapsList({ gaps }: { gaps: SeoContentGapItem[] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Content-Lücken gefunden (oder noch keine Google-Search-Console-Verbindung - siehe Konfiguration).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {gaps.map((gap) => (
        <GapRow key={gap.id} gap={gap} />
      ))}
    </div>
  );
}
