"use client";

import { PYRAMID_STAGE_OPTIONS, type ContentPyramidStageValue } from "@/lib/social/content-pyramid";

/**
 * Quality-Control-Widget für die Content-Pyramide: zeigt die Ist-Verteilung
 * der aktuellen Beiträge (Pipeline + geplant/veröffentlicht, FAILED
 * ausgenommen) gegen das feste 60/30/10-Ziel aus content-pyramid.ts. Bewusst
 * sichtbar über Board/Kalender platziert statt in einem Unter-Tab versteckt,
 * da es laufende Hintergrund-Qualitätskontrolle sein soll, siehe
 * content-tab.tsx.
 */
export function ContentPyramidOverview({
  posts,
}: {
  posts: { status: string; pyramidStage: ContentPyramidStageValue | null }[];
}) {
  const relevant = posts.filter((p) => p.status !== "FAILED");
  const total = relevant.length;
  const withoutStage = relevant.filter((p) => !p.pyramidStage).length;

  const counts: Record<ContentPyramidStageValue, number> = { REACH: 0, EDUCATION: 0, CONVERSION: 0 };
  for (const post of relevant) {
    if (post.pyramidStage) counts[post.pyramidStage] += 1;
  }

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">Content-Pyramide: Ist-Verteilung vs. 60/30/10-Ziel</p>
      <div className="flex flex-col gap-2">
        {PYRAMID_STAGE_OPTIONS.map((option) => {
          const actualPercent = total > 0 ? Math.round((counts[option.value] / total) * 100) : 0;
          const deviation = actualPercent - option.targetPercent;
          const isOff = Math.abs(deviation) >= 15;
          return (
            <div key={option.value} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{option.label}</span>
                <span className={isOff ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  {actualPercent}% (Ziel {option.targetPercent}%) - {counts[option.value]} von {total}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                  style={{ width: `${Math.min(actualPercent, 100)}%` }}
                />
                <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${Math.min(option.targetPercent, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {withoutStage > 0 && (
        <p className="text-xs text-muted-foreground">
          {withoutStage} von {total} Beiträgen ohne zugeordnete Pyramide-Stufe (zählen nicht in der Verteilung oben mit).
        </p>
      )}
    </div>
  );
}
