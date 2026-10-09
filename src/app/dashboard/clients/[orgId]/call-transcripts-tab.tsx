"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CallTranscriptSource = "FIREFLIES" | "CLOSE";

export type CallTranscriptItem = {
  id: string;
  source: CallTranscriptSource;
  title: string;
  dateTime: string;
  durationMinutes: number | null;
  organizerEmail: string | null;
  participants: string[];
  summaryOverview: string | null;
  transcriptText: string | null;
};

const SOURCE_LABELS: Record<CallTranscriptSource, string> = {
  FIREFLIES: "Fireflies",
  CLOSE: "Close.io",
};

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "";
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h ${rounded % 60}min` : `${rounded}min`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Baut das Quelle-Label, das bei "Idee daraus generieren" an den Ideen-Dialog übergeben wird - siehe ideaSourceLabel auf SocialPost. */
function buildSourceLabel(t: CallTranscriptItem): string {
  const parts = [`${SOURCE_LABELS[t.source]}: "${t.title}"`, `vom ${formatDateTime(t.dateTime)}`];
  if (t.participants.length > 0) parts.push(`(${t.participants.join(", ")})`);
  return parts.join(" ");
}

/**
 * Browser für die per Cron synchronisierten Call-Transkripte aus Fireflies
 * UND Close.io (siehe src/lib/actions/fireflies.ts, close-calls.ts) - nur im
 * internen Marketing-Center sichtbar (isInternalOrg, content-tab.tsx), da
 * Calls über alle Kunden hinweg sensible Inhalte enthalten können. "Idee
 * daraus generieren" übergibt den vollen Transkripttext plus ein Quelle-Label
 * als Quelltext an den bestehenden Ideen-Dialog, statt ihn von Hand aus
 * Fireflies/Close kopieren zu müssen - das Label landet später sichtbar auf
 * der Karte (social-post-board.tsx), damit die Herkunft nachvollziehbar bleibt.
 */
export function CallTranscriptsTab({
  transcripts,
  onUseAsIdeaSource,
}: {
  transcripts: CallTranscriptItem[];
  onUseAsIdeaSource: (text: string, sourceLabel: string) => void;
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
        nach dem ersten Lauf erscheinen Sales Calls, Kunden-Calls, Cold Calls etc. hier.
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
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {SOURCE_LABELS[t.source]}
                </span>
                <p className="text-sm font-medium">{t.title}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(t.dateTime)}
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
                onClick={() => t.transcriptText && onUseAsIdeaSource(t.transcriptText, buildSourceLabel(t))}
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
