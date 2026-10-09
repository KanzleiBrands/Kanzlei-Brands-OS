"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { applyVideoImportMapping } from "@/lib/actions/video-import";
import type { VideoImportLessonCandidate, VideoImportMatch } from "@/lib/video-import-matching";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABELS: Record<VideoImportMatch["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sicher: { label: "Sicher", variant: "default" },
  unsicher: { label: "Unsicher", variant: "secondary" },
  mehrdeutig: { label: "Mehrdeutig", variant: "secondary" },
  kein_treffer: { label: "Kein Treffer", variant: "outline" },
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function lessonLabel(lesson: VideoImportLessonCandidate): string {
  return `${lesson.title} — ${lesson.courseTitle} / ${lesson.moduleTitle}`;
}

export function VideoImportTable({
  matches,
  lessons,
}: {
  matches: VideoImportMatch[];
  lessons: VideoImportLessonCandidate[];
}) {
  const [selection, setSelection] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(matches.map((m) => [m.blob.url, m.suggestedLessonId])),
  );
  // "Mehrdeutig" (mehrere ähnlich gute Kandidaten) und "kein_treffer" brauchen
  // echtes manuelles Eingreifen - bei "sicher" und "unsicher" gibt es jeweils
  // genau einen vorgeschlagenen Kandidaten, den übernehmen wir vorausgewählt.
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(matches.map((m) => [m.blob.url, m.status === "sicher" || m.status === "unsicher"])),
  );
  const [isPending, startTransition] = useTransition();

  const sortedLessons = useMemo(() => [...lessons].sort((a, b) => lessonLabel(a).localeCompare(lessonLabel(b))), [lessons]);

  function handleSubmit() {
    const mappings = matches
      .filter((m) => checked[m.blob.url] && selection[m.blob.url])
      .map((m) => ({ blobUrl: m.blob.url, lessonId: selection[m.blob.url] as string }));

    if (mappings.length === 0) {
      toast.error("Keine Zeile ausgewählt.");
      return;
    }

    startTransition(async () => {
      const result = await applyVideoImportMapping(mappings);
      if (result.skipped.length > 0) {
        toast.error(`${result.applied} übernommen, ${result.skipped.length} übersprungen: ${result.skipped.join("; ")}`);
      } else {
        toast.success(`${result.applied} Video(s) zugeordnet.`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Datei</TableHead>
            <TableHead>Größe</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Lektion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => {
            const status = STATUS_LABELS[match.status];
            const selectedLessonId = selection[match.blob.url];
            const selectedLesson = lessons.find((l) => l.id === selectedLessonId);
            return (
              <TableRow key={match.blob.url}>
                <TableCell>
                  <Checkbox
                    checked={checked[match.blob.url] ?? false}
                    disabled={!selectedLessonId}
                    onCheckedChange={(value) => setChecked((prev) => ({ ...prev, [match.blob.url]: value === true }))}
                  />
                </TableCell>
                <TableCell className="max-w-64 truncate font-medium" title={match.filename}>
                  {match.filename}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatSize(match.blob.size)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={status.variant} className="w-fit">
                      {status.label}
                      {match.score > 0 && ` · ${Math.round(match.score * 100)}%`}
                    </Badge>
                    {selectedLesson?.hasVideo && (
                      <span className="text-xs text-destructive">Überschreibt vorhandenes Video</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={selectedLessonId ?? undefined}
                    onValueChange={(value) => {
                      setSelection((prev) => ({ ...prev, [match.blob.url]: value }));
                      setChecked((prev) => ({ ...prev, [match.blob.url]: true }));
                    }}
                  >
                    <SelectTrigger className="w-full min-w-72">
                      <SelectValue placeholder="Lektion wählen...">
                        {(value: string) => {
                          const lesson = lessons.find((l) => l.id === value);
                          return lesson ? lessonLabel(lesson) : "Lektion wählen...";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {sortedLessons.map((lesson) => (
                        <SelectItem key={lesson.id} value={lesson.id}>
                          {lessonLabel(lesson)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          Zuordnung übernehmen
        </Button>
      </div>
    </div>
  );
}
