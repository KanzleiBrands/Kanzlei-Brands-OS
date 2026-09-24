"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ScissorsIcon,
  DownloadIcon,
  RotateCcwIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
  PlayIcon,
  PauseIcon,
  RewindIcon,
  FastForwardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFFmpeg } from "@/lib/ffmpeg-client";

const THUMBNAIL_COUNT = 18;
const MIN_SELECTION_SECONDS = 0.5;
const SKIP_SECONDS = 5;

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

  function skip(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(endTime, Math.max(startTime, video.currentTime + deltaSeconds));
    setCurrentTime(video.currentTime);
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

  return createPortal(
    // Portaled straight to <body>: this dialog is opened from inside a
    // shadcn Dialog, whose content box is CSS-transformed for centering -
    // any transformed ancestor becomes the containing block for `position:
    // fixed` descendants, so without the portal this would be pinned to
    // that small dialog box instead of the actual viewport.
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-md sm:p-8">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Video zuschneiden</h2>
            <p className="mt-1 text-sm text-white/50">Wähle den Bereich, den du behalten möchtest.</p>
          </div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => handleOpenChange(false)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "16 / 9" }}>
            <video
              src={activeUrl}
              aria-hidden
              muted
              loop
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
            />
            <video
              ref={videoRef}
              src={activeUrl}
              className="relative h-full w-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onClick={togglePlay}
              playsInline
            />
            <button
              type="button"
              aria-label={isPlaying ? "Pausieren" : "Abspielen"}
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center transition-opacity"
            >
              <span
                className={`flex size-16 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm transition-all ${isPlaying ? "opacity-0 hover:opacity-100" : "opacity-90 hover:opacity-100"}`}
              >
                {isPlaying ? <PauseIcon className="size-7" /> : <PlayIcon className="size-7 translate-x-0.5" />}
              </span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-white/[0.04] p-1.5 ring-1 ring-white/10">
            <button
              type="button"
              aria-label={`${SKIP_SECONDS}s zurück`}
              onClick={() => skip(-SKIP_SECONDS)}
              className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RewindIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label={isPlaying ? "Pausieren" : "Abspielen"}
              onClick={togglePlay}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4 translate-x-0.5" />}
            </button>
            <span className="min-w-28 px-2 text-center font-mono text-sm tabular-nums text-white/80">
              {formatTime(Math.max(currentTime, startTime))} / {formatTime(endTime)}
            </span>
            <button
              type="button"
              aria-label={`${SKIP_SECONDS}s vor`}
              onClick={() => skip(SKIP_SECONDS)}
              className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <FastForwardIcon className="size-4" />
            </button>
          </div>

          <div
            ref={timelineRef}
            className="relative mt-5 h-24 w-full overflow-hidden rounded-xl bg-neutral-800 ring-1 ring-white/10 select-none sm:h-28"
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

            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-neutral-950/75"
              style={{ width: `${startPct}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-neutral-950/75"
              style={{ width: `${100 - endPct}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 shadow-[0_0_0_9999px_rgba(0,0,0,0)] ring-2 ring-primary"
              style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
            />

            <div
              role="slider"
              aria-label="Startzeit"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={startTime}
              className="group absolute inset-y-0 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
              style={{ left: `${startPct}%` }}
              onMouseDown={() => setDragging("start")}
            >
              <div className="h-full w-1.5 rounded-full bg-primary shadow-md transition-transform group-hover:scale-x-125" />
            </div>
            <div
              role="slider"
              aria-label="Endzeit"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={endTime}
              className="group absolute inset-y-0 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
              style={{ left: `${endPct}%` }}
              onMouseDown={() => setDragging("end")}
            >
              <div className="h-full w-1.5 rounded-full bg-primary shadow-md transition-transform group-hover:scale-x-125" />
            </div>

            {dragging && (
              <div
                className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow-md"
                style={{ left: `${dragging === "start" ? startPct : endPct}%` }}
              >
                {formatTime(dragging === "start" ? startTime : endTime)}
              </div>
            )}
          </div>

          {processing && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                <span>Wird geschnitten...</span>
                <span className="ml-auto font-medium">{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {resultUrl && !processing && (
            <p className="mt-4 text-sm text-emerald-400">
              Zuschnitt angewendet - &bdquo;Übernehmen&ldquo; um zu speichern.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-6 py-4 sm:px-8">
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
            <Button type="button" onClick={handleAccept} disabled={processing || !resultBlob}>
              <CheckIcon className="size-4" />
              Übernehmen
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
