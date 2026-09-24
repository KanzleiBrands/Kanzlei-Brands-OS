"use client";

import { useEffect, useRef, useState } from "react";
import {
  ScissorsIcon,
  DownloadIcon,
  RotateCcwIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
  PlayIcon,
  PauseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFFmpeg } from "@/lib/ffmpeg-client";

const THUMBNAIL_COUNT = 10;
const MIN_SELECTION_SECONDS = 0.5;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function extensionForType(type: string): string {
  if (type.includes("mp4")) return "mp4";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("ogg")) return "ogv";
  return "webm";
}

/** Runs the actual ffmpeg cut, preferring a fast stream-copy and falling back to a re-encode if that fails or produces no usable output. */
async function cutWithFallback(
  ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>,
  inputName: string,
  outputName: string,
  startTime: number,
  endTime: number,
): Promise<Uint8Array> {
  const baseArgs = ["-i", inputName, "-ss", String(startTime), "-to", String(endTime)];
  try {
    await ffmpeg.exec([...baseArgs, "-c", "copy", outputName]);
    const output = await ffmpeg.readFile(outputName);
    if (output instanceof Uint8Array && output.length > 1000) return output;
    await ffmpeg.deleteFile(outputName).catch(() => {});
  } catch {
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
  await ffmpeg.exec([...baseArgs, outputName]);
  const output = await ffmpeg.readFile(outputName);
  if (!(output instanceof Uint8Array)) throw new Error("Unerwartetes Ausgabeformat.");
  return output;
}

/**
 * Trims a video (freshly recorded or already uploaded) to a selected range,
 * matching LearningSuite's flow: a thumbnail filmstrip with draggable
 * in/out handles, then "Schneiden" runs the actual cut via ffmpeg.wasm
 * (self-hosted, see src/lib/ffmpeg-client.ts) entirely in the browser.
 */
export function VideoTrimmer({
  videoUrl,
  fileName,
  onTrimmed,
}: {
  videoUrl: string;
  fileName?: string;
  onTrimmed: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activeUrl = resultUrl ?? videoUrl;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setResultUrl(null);
      setResultBlob(null);
      setError(null);
      setThumbnails([]);
      setIsPlaying(false);
    }
  }

  async function generateThumbnails(url: string, videoDuration: number) {
    setThumbnailsLoading(true);
    setThumbnails([]);
    const hiddenVideo = document.createElement("video");
    hiddenVideo.src = url;
    hiddenVideo.muted = true;
    hiddenVideo.preload = "auto";
    await new Promise<void>((resolve) => {
      hiddenVideo.onloadedmetadata = () => resolve();
    });
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    const frames: string[] = [];
    for (let i = 0; i < THUMBNAIL_COUNT; i++) {
      const t = (videoDuration / THUMBNAIL_COUNT) * (i + 0.5);
      await new Promise<void>((resolve) => {
        hiddenVideo.onseeked = () => resolve();
        hiddenVideo.currentTime = Math.min(t, Math.max(videoDuration - 0.05, 0));
      });
      if (ctx) {
        ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.6));
      }
    }
    setThumbnails(frames);
    setThumbnailsLoading(false);
  }

  /**
   * Chrome reports `duration: Infinity` for MediaRecorder-produced blobs
   * (the webm container has no duration in its header since it was streamed
   * out live) until you seek near the end, which forces it to scan and
   * compute the real duration - the standard workaround for this quirk.
   */
  function resolveDuration(video: HTMLVideoElement): Promise<number> {
    return new Promise((resolve) => {
      if (Number.isFinite(video.duration)) {
        resolve(video.duration);
        return;
      }
      const onTimeUpdate = () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        const resolved = Number.isFinite(video.duration) ? video.duration : 0;
        video.currentTime = 0;
        resolve(resolved);
      };
      video.addEventListener("timeupdate", onTimeUpdate);
      video.currentTime = 1e9;
    });
  }

  async function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const d = await resolveDuration(video);
    if (d <= 0) return;
    setDuration(d);
    setStartTime(0);
    setEndTime(d);
    generateThumbnails(activeUrl, d);
  }

  function timeFromClientX(clientX: number): number {
    const el = timelineRef.current;
    if (!el || duration === 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const t = timeFromClientX(e.clientX);
      if (dragging === "start") {
        setStartTime(Math.min(t, endTime - MIN_SELECTION_SECONDS));
      } else {
        setEndTime(Math.max(t, startTime + MIN_SELECTION_SECONDS));
      }
    }
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, startTime, endTime, duration]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < startTime || video.currentTime >= endTime) video.currentTime = startTime;
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime >= endTime) {
      video.pause();
      video.currentTime = startTime;
      setIsPlaying(false);
    }
  }

  function resetSelection() {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
      setResultBlob(null);
      return;
    }
    setStartTime(0);
    setEndTime(duration);
  }

  async function performCut() {
    setProcessing(true);
    setProgress(0);
    setError(null);
    try {
      const response = await fetch(activeUrl);
      const blob = await response.blob();
      const type = blob.type || "video/webm";
      const ext = extensionForType(type);
      const inputName = `input.${ext}`;
      const outputName = `output.${ext}`;
      const data = new Uint8Array(await blob.arrayBuffer());

      const ffmpeg = await getFFmpeg();
      const onProgress = ({ progress: p }: { progress: number }) => setProgress(Math.round(Math.min(1, Math.max(0, p)) * 100));
      ffmpeg.on("progress", onProgress);
      try {
        await ffmpeg.writeFile(inputName, data);
        const output = await cutWithFallback(ffmpeg, inputName, outputName, startTime, endTime);
        const trimmedBlob = new Blob([new Uint8Array(output)], { type });
        setResultBlob(trimmedBlob);
        setResultUrl(URL.createObjectURL(trimmedBlob));
      } finally {
        ffmpeg.off("progress", onProgress);
        await ffmpeg.deleteFile(inputName).catch(() => {});
        await ffmpeg.deleteFile(outputName).catch(() => {});
      }
    } catch (err) {
      console.error("[VideoTrimmer] cut failed:", err);
      setError("Schneiden fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setProcessing(false);
    }
  }

  function handleDownload() {
    const a = document.createElement("a");
    a.href = activeUrl;
    a.download = fileName ?? "video.webm";
    a.click();
  }

  function handleAccept() {
    if (!resultBlob) return;
    const ext = extensionForType(resultBlob.type);
    const file = new File([resultBlob], fileName ?? `zugeschnitten.${ext}`, { type: resultBlob.type });
    onTrimmed(file);
    handleOpenChange(false);
  }

  const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100;

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <ScissorsIcon className="size-4" />
        Schneiden
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 p-4">
      <div className="flex w-full max-w-3xl flex-col gap-4 rounded-xl bg-neutral-900 p-5 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Video zuschneiden</h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => handleOpenChange(false)}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            src={activeUrl}
            className="max-h-[45vh] w-full"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            playsInline
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={isPlaying ? "Pausieren" : "Abspielen"}
            onClick={togglePlay}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          </button>
          <span className="font-mono text-sm tabular-nums text-white/70">
            {formatTime(Math.max(currentTime, startTime))} / {formatTime(endTime)}
          </span>
        </div>

        <div
          ref={timelineRef}
          className="relative h-20 w-full overflow-hidden rounded-md bg-neutral-800 select-none"
        >
          {thumbnailsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2Icon className="size-5 animate-spin text-white/50" />
            </div>
          ) : (
            <div className="flex h-full w-full">
              {thumbnails.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="h-full flex-1 object-cover" draggable={false} />
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute inset-y-0 left-0 bg-black/70" style={{ width: `${startPct}%` }} />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 bg-black/70"
            style={{ width: `${100 - endPct}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 border-y-2 border-primary"
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
          />

          <div
            role="slider"
            aria-label="Startzeit"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={startTime}
            className="absolute inset-y-0 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center bg-primary"
            style={{ left: `${startPct}%` }}
            onMouseDown={() => setDragging("start")}
          >
            <div className="h-8 w-0.5 rounded bg-primary-foreground" />
          </div>
          <div
            role="slider"
            aria-label="Endzeit"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={endTime}
            className="absolute inset-y-0 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center bg-primary"
            style={{ left: `${endPct}%` }}
            onMouseDown={() => setDragging("end")}
          >
            <div className="h-8 w-0.5 rounded bg-primary-foreground" />
          </div>

          {dragging && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground"
              style={{ left: `${dragging === "start" ? startPct : endPct}%` }}
            >
              {formatTime(dragging === "start" ? startTime : endTime)}
            </div>
          )}
        </div>

        {processing && (
          <div className="rounded-md border border-white/10 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
              <span>Wird geschnitten...</span>
              <span className="ml-auto font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {resultUrl && !processing && (
          <p className="text-sm text-emerald-400">Zuschnitt angewendet - &bdquo;Übernehmen&ldquo; um zu speichern.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={processing}>
              <DownloadIcon className="size-4" />
              Download
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetSelection}
              disabled={processing || (!resultUrl && startTime === 0 && endTime === duration)}
            >
              <RotateCcwIcon className="size-4" />
              Zurücksetzen
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={performCut} disabled={processing}>
              <ScissorsIcon className="size-4" />
              {processing ? "Wird geschnitten..." : "Schneiden"}
            </Button>
            <Button type="button" size="sm" onClick={handleAccept} disabled={processing || !resultBlob}>
              <CheckIcon className="size-4" />
              Übernehmen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
