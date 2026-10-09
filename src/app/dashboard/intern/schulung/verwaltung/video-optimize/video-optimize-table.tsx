"use client";

import { useState } from "react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { CheckCircle2Icon, Loader2Icon, SparklesIcon } from "lucide-react";
import { markLessonVideoOptimized } from "@/lib/actions/courses";
import { remuxVideoForFastStart } from "@/lib/video-optimize-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type VideoOptimizeRow = {
  id: string;
  title: string;
  courseTitle: string;
  moduleTitle: string;
  videoUrl: string;
  optimizedAt: string | null;
};

type RowStatus = "idle" | "running" | "done" | "error";

export function VideoOptimizeTable({ rows }: { rows: VideoOptimizeRow[] }) {
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [bulkRunning, setBulkRunning] = useState(false);

  async function optimizeOne(row: VideoOptimizeRow) {
    setStatus((s) => ({ ...s, [row.id]: "running" }));
    setProgress((p) => ({ ...p, [row.id]: 0 }));
    try {
      const { blob, fileName } = await remuxVideoForFastStart(row.videoUrl, (pct) =>
        setProgress((p) => ({ ...p, [row.id]: pct })),
      );
      const uploaded = await upload(fileName, blob, { access: "public", handleUploadUrl: "/api/uploads/video" });
      const result = await markLessonVideoOptimized(row.id, uploaded.url);
      if ("error" in result) throw new Error(result.error);
      setStatus((s) => ({ ...s, [row.id]: "done" }));
    } catch (err) {
      console.error("[VideoOptimize] failed:", err);
      setStatus((s) => ({ ...s, [row.id]: "error" }));
      toast.error(`${row.title}: Optimierung fehlgeschlagen.`);
    }
  }

  async function optimizeAll() {
    setBulkRunning(true);
    const pending = rows.filter((r) => !r.optimizedAt && status[r.id] !== "done");
    for (const row of pending) {
      await optimizeOne(row);
    }
    setBulkRunning(false);
    toast.success("Alle offenen Videos durchlaufen.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={optimizeAll} disabled={bulkRunning}>
          {bulkRunning ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
          Alle noch nicht optimierten Videos jetzt optimieren
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lektion</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-48" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const st = status[row.id] ?? (row.optimizedAt ? "done" : "idle");
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.courseTitle} / {row.moduleTitle}
                  </p>
                </TableCell>
                <TableCell>
                  {st === "done" ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2Icon className="size-3.5" />
                      Optimiert
                    </Badge>
                  ) : st === "running" ? (
                    <span className="text-sm text-muted-foreground">Wird optimiert... {progress[row.id] ?? 0}%</span>
                  ) : st === "error" ? (
                    <Badge variant="destructive">Fehlgeschlagen</Badge>
                  ) : (
                    <Badge variant="outline">Noch nicht optimiert</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={st === "running" || bulkRunning}
                    onClick={() => optimizeOne(row)}
                  >
                    {st === "done" ? "Erneut optimieren" : "Jetzt optimieren"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
