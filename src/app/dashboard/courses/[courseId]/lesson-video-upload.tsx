"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloudIcon, CheckCircle2Icon, Loader2Icon, PlayCircleIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { VideoRecorder } from "./video-recorder";
import { VideoTrimmer } from "./video-trimmer";

type Status = "idle" | "uploading" | "done" | "error";

/**
 * Uploads a video straight from the browser to Vercel Blob (bypassing our
 * own server entirely, in automatically-chunked multipart requests), so
 * there's no Server Action body-size limit and no Vercel Function payload
 * cap to hit - any file size works, and speed is limited only by the
 * upload's own bandwidth, not a round-trip through our backend. The
 * resulting URL is placed in a hidden "videoUrl" field for the surrounding
 * form to submit. Falls back to a plain file input (submitted the old way,
 * through the server action) if the direct-upload endpoint isn't reachable
 * - e.g. local dev without a BLOB_READ_WRITE_TOKEN configured.
 */
export function LessonVideoUpload({ existingVideoUrl }: { existingVideoUrl?: string | null }) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackFile, setFallbackFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setFileName(file.name);
    setError(null);
    setRemoved(false);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/video",
        onUploadProgress: (event) => setProgress(Math.round(event.percentage)),
      });
      setVideoUrl(blob.url);
      setStatus("done");
    } catch {
      // No Blob token configured (e.g. local dev) or the direct upload
      // otherwise failed - fall back to the classic file-input path, which
      // still works for smaller files via the server action. Carry the file
      // over (it may be an in-memory recording with nothing on disk to
      // re-pick) by injecting it into the fallback input via DataTransfer.
      setUseFallback(true);
      setFallbackFile(file);
      setStatus("idle");
      setError(null);
    }
  }

  useEffect(() => {
    if (useFallback && fallbackFile && inputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(fallbackFile);
      inputRef.current.files = dataTransfer.files;
    }
  }, [useFallback, fallbackFile]);

  if (useFallback) {
    return (
      <div className="flex flex-col gap-1">
        <Input
          ref={inputRef}
          name="video"
          type="file"
          accept="video/*"
          onChange={(e) => setFallbackFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Direkter Upload nicht verfügbar - dieser Weg ist auf kleinere Dateien begrenzt.
          {fallbackFile && " Aufnahme wurde übernommen."}
        </p>
      </div>
    );
  }

  const hasExisting = !!existingVideoUrl && !removed;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="videoUrl" value={videoUrl ?? ""} />
      <input type="hidden" name="removeVideo" value={removed ? "1" : ""} />

      {status === "idle" && hasExisting && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
          <PlayCircleIcon className="size-5 shrink-0 text-primary" />
          <span className="flex-1 font-medium">Video vorhanden</span>
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
            <UploadCloudIcon className="size-3.5" />
            Ersetzen
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          <VideoRecorder onCaptured={handleFile} />
          <VideoTrimmer videoUrl={existingVideoUrl!} fileName="zugeschnitten.mp4" onTrimmed={handleFile} />
          <button
            type="button"
            onClick={() => setRemoved(true)}
            aria-label="Video entfernen"
            className="text-muted-foreground hover:text-destructive"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {status === "idle" && !hasExisting && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <UploadCloudIcon className="size-4 shrink-0" />
            Video auswählen - jede Dateigröße, lädt direkt hoch
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          <VideoRecorder onCaptured={handleFile} />
          {removed && (
            <button
              type="button"
              onClick={() => setRemoved(false)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Rückgängig
            </button>
          )}
        </div>
      )}
      {removed && (
        <p className="text-xs text-muted-foreground">Video wird beim Speichern entfernt.</p>
      )}

      {status === "uploading" && (
        <div className="rounded-md border p-3">
          <div className="mb-1.5 flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
            <span className="truncate">{fileName}</span>
            <span className="ml-auto shrink-0 font-medium">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
          <span className="truncate">{fileName}</span>
          {videoUrl && <VideoTrimmer videoUrl={videoUrl} fileName={fileName ?? undefined} onTrimmed={handleFile} />}
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setVideoUrl(null);
              setFileName(null);
            }}
            aria-label="Video entfernen"
            className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
