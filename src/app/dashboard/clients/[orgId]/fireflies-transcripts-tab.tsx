"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FirefliesTranscriptItem = {
  id: string;
  title: string;
  dateTime: string;
  durationMinutes: number | null;
  organizerEmail: string | null;
  participants: string[];
  summaryOverview: string | null;
  transcriptText: string | null;
};

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "";
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h ${rounded % 60}min` : `${rounded}min`;
}

/**
 * Browser für die per Cron synchronisierten Fireflies-Call-Transkripte (siehe
 * src/lib/actions/fireflies.ts) - nur im internen Marketing-Center sichtbar
 * (isInternalOrg, content-tab.tsx), da Calls über alle Kunden hinweg sensible
 * Inhalte enthalten können. "Idee daraus generieren" übergibt den vollen
 * Transkripttext als Quelltext an den bestehenden Ideen-Dialog, statt ihn von
 * Hand aus Fireflies kopieren zu müssen.
 */
export function FirefliesTranscriptsTab({
  transcripts,
  onUseAsIdeaSource,
}: {
  transcripts: FirefliesTranscriptItem[];
  onUseAsIdeaSource: (text: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = transcripts.filter((t) => {
    if (!query.trim()) return true;
    const haystack = `${t.title} ${t.participants.join(" ")} ${t.organizerEmail ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  if (transcripts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Call-Transkripte synchronisiert. Der Sync läuft automatisch im Hintergrund (siehe Konfiguration-Reiter) -
        nach dem ersten Lauf erscheinen Sales Calls, Kunden-Calls etc. hier.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Suche nach Titel oder Teilnehmer..."
        className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
      />
      <div className="flex flex-col gap-2">
        {filtered.map((t) => (
          <div key={t.id} className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{t.title}</p>
              <span className="text-xs text-muted-foreground">
                {new Date(t.dateTime).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {t.durationMinutes != null && ` · ${formatDuration(t.durationMinutes)}`}
              </span>
            </div>
            {t.participants.length > 0 && (
              <p className="text-xs text-muted-foreground">Teilnehmer: {t.participants.join(", ")}</p>
            )}
            {t.summaryOverview && <p className="text-sm text-muted-foreground">{t.summaryOverview}</p>}
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!t.transcriptText}
                onClick={() => t.transcriptText && onUseAsIdeaSource(t.transcriptText)}
              >
                <SparklesIcon className="size-4" />
                Idee daraus generieren
              </Button>
              {!t.transcriptText && (
                <span className="ml-2 text-xs text-muted-foreground">Volltext wird noch geladen...</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Keine Treffer.</p>}
      </div>
    </div>
  );
}
