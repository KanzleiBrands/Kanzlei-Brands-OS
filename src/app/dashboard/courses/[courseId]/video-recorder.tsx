"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MonitorIcon,
  PictureInPicture2Icon,
  CameraIcon,
  CircleIcon,
  SquareIcon,
  PauseIcon,
  PlayIcon,
  MicIcon,
  MicOffIcon,
  RotateCcwIcon,
  CheckIcon,
  XIcon,
  VideoIcon,
  ImageDownIcon,
  LayoutGridIcon,
  SettingsIcon,
  FlipHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoTrimmer } from "./video-trimmer";

type Source = "screen" | "camera" | "both";
type Stage = "source" | "live" | "countdown" | "recording" | "preview";

const SOURCE_OPTIONS: { key: Source; label: string; icon: typeof MonitorIcon }[] = [
  { key: "screen", label: "Bildschirm", icon: MonitorIcon },
  { key: "both", label: "Kamera & Bildschirm", icon: PictureInPicture2Icon },
  { key: "camera", label: "Kamera", icon: CameraIcon },
];

const MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function pickMimeType(): string {
  return MIME_CANDIDATES.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * In-browser screen/camera recorder for lesson videos, matching LearningSuite's
 * flow: choose a source, adjust devices, countdown, record (with pause/stop),
 * preview, then hand the captured file to the caller exactly like a manually
 * picked file - the caller (LessonVideoUpload) uploads it the same way either
 * path produces a File.
 */
export function VideoRecorder({ onCaptured }: { onCaptured: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [stage, setStage] = useState<Stage>("source");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [micMuted, setMicMuted] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | "GO" | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [mirrorCamera, setMirrorCamera] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const stageRef = useRef<Stage>("source");
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const compositeRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const stopTrack = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

  const cleanupMedia = useCallback(() => {
    stopTrack(camStreamRef.current);
    stopTrack(screenStreamRef.current);
    stopTrack(micStreamRef.current);
    camStreamRef.current = null;
    screenStreamRef.current = null;
    micStreamRef.current = null;
    if (compositeRafRef.current) cancelAnimationFrame(compositeRafRef.current);
    compositeRafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
  }, []);

  const closeRecorder = useCallback(() => {
    cleanupMedia();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    recordedBlobRef.current = null;
    setSource(null);
    setStage("source");
    setErrorMsg(null);
    setCountdownValue(null);
    setElapsedSeconds(0);
    setIsPaused(false);
    setOpen(false);
  }, [cleanupMedia, recordedUrl]);

  useEffect(() => {
    return () => cleanupMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshDeviceList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameraDevices(devices.filter((d) => d.kind === "videoinput"));
    setMicDevices(devices.filter((d) => d.kind === "audioinput"));
  }

  async function chooseSource(src: Source) {
    setErrorMsg(null);
    try {
      if (src === "screen" || src === "both") {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (stageRef.current === "recording") stopRecording();
          else closeRecorder();
        });
      }
      if (src === "camera" || src === "both") {
        camStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        });
      }
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });

      await refreshDeviceList();
      setSource(src);
      setStage("live");
    } catch {
      cleanupMedia();
      setErrorMsg("Zugriff auf Kamera, Bildschirm oder Mikrofon wurde verweigert oder ist nicht verfügbar.");
    }
  }

  useEffect(() => {
    if (stage === "live" || stage === "countdown" || stage === "recording") {
      // The `autoPlay` attribute isn't reliable once srcObject is assigned
      // imperatively after mount (varies by browser) - explicitly starting
      // playback is what makes the preview (and, for "both" mode, the
      // canvas composite that's actually recorded) reliably show real frames
      // instead of staying black.
      if (camVideoRef.current && camStreamRef.current) {
        camVideoRef.current.srcObject = camStreamRef.current;
        camVideoRef.current.play().catch(() => {});
      }
      if (screenVideoRef.current && screenStreamRef.current) {
        screenVideoRef.current.srcObject = screenStreamRef.current;
        screenVideoRef.current.play().catch(() => {});
      }
    }
  }, [stage, source]);

  const startCompositeLoop = useCallback(() => {
    if (compositeRafRef.current) return;
    function draw() {
      // requestAnimationFrame never reschedules itself if this throws, which
      // would silently kill the whole composite loop forever (permanently
      // black recording) - never let a transient frame error do that.
      try {
        const canvas = canvasRef.current;
        const screenVideo = screenVideoRef.current;
        const camVideo = camVideoRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx && screenVideo && screenVideo.readyState >= 2 && screenVideo.videoWidth > 0) {
          const w = screenVideo.videoWidth;
          const h = screenVideo.videoHeight;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          ctx.drawImage(screenVideo, 0, 0, w, h);
          if (camVideo && camVideo.readyState >= 2 && camVideo.videoWidth > 0) {
            const pipW = Math.round(w * 0.22);
            const pipH = Math.round(pipW * (camVideo.videoHeight / camVideo.videoWidth));
            const margin = Math.round(w * 0.02);
            const pipX = margin;
            const pipY = h - pipH - margin;
            ctx.save();
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(pipX, pipY, pipW, pipH, 14);
            else ctx.rect(pipX, pipY, pipW, pipH);
            ctx.clip();
            ctx.drawImage(camVideo, pipX, pipY, pipW, pipH);
            ctx.restore();
          }
        }
      } catch (err) {
        console.error("[VideoRecorder] composite frame failed:", err);
      }
      compositeRafRef.current = requestAnimationFrame(draw);
    }
    draw();
  }, []);

  useEffect(() => {
    if (source === "both" && (stage === "live" || stage === "countdown" || stage === "recording")) {
      startCompositeLoop();
    }
  }, [source, stage, startCompositeLoop]);

  async function switchCamera(deviceId: string) {
    setSelectedCamera(deviceId);
    if (!camStreamRef.current) return;
    stopTrack(camStreamRef.current);
    camStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
    if (camVideoRef.current) {
      camVideoRef.current.srcObject = camStreamRef.current;
      camVideoRef.current.play().catch(() => {});
    }
  }

  async function switchMic(deviceId: string) {
    setSelectedMic(deviceId);
    stopTrack(micStreamRef.current);
    micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
    micStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !micMuted));
  }

  function toggleMic() {
    const next = !micMuted;
    setMicMuted(next);
    micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }

  function takeScreenshot() {
    const source2 =
      source === "both" ? canvasRef.current : source === "screen" ? screenVideoRef.current : camVideoRef.current;
    if (!source2) return;
    const canvas = document.createElement("canvas");
    canvas.width = source2 instanceof HTMLVideoElement ? source2.videoWidth : source2.width;
    canvas.height = source2 instanceof HTMLVideoElement ? source2.videoHeight : source2.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source2, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `screenshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  function startCountdown() {
    setStage("countdown");
    let n = 3;
    setCountdownValue(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdownValue(n);
      } else if (n === 0) {
        setCountdownValue("GO");
      } else {
        clearInterval(iv);
        setCountdownValue(null);
        beginRecording();
      }
    }, 700);
  }

  function beginRecording() {
    let videoTrack: MediaStreamTrack | undefined;
    if (source === "both") {
      const canvasStream = canvasRef.current?.captureStream(30);
      videoTrack = canvasStream?.getVideoTracks()[0];
    } else if (source === "screen") {
      videoTrack = screenStreamRef.current?.getVideoTracks()[0];
    } else {
      videoTrack = camStreamRef.current?.getVideoTracks()[0];
    }
    const audioTrack = micStreamRef.current?.getAudioTracks()[0];
    if (!videoTrack) {
      setErrorMsg("Aufnahme konnte nicht gestartet werden.");
      setStage("live");
      return;
    }
    const tracks = audioTrack ? [videoTrack, audioTrack] : [videoTrack];
    const finalStream = new MediaStream(tracks);

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(finalStream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      recordedBlobRef.current = blob;
      setRecordedUrl(URL.createObjectURL(blob));
      setStage("preview");
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setStage("recording");
    setElapsedSeconds(0);
    setIsPaused(false);
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  }

  function togglePause() {
    if (!recorderRef.current) return;
    if (isPaused) {
      recorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else {
      recorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsPaused((p) => !p);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function retry() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    recordedBlobRef.current = null;
    setStage("live");
  }

  function handleTrimmed(file: File) {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    recordedBlobRef.current = file;
    setRecordedUrl(URL.createObjectURL(file));
  }

  function accept() {
    if (!recordedBlobRef.current) return;
    const file = new File([recordedBlobRef.current], `aufnahme-${Date.now()}.webm`, {
      type: recordedBlobRef.current.type,
    });
    onCaptured(file);
    closeRecorder();
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          setStage("source");
        }}
      >
        <VideoIcon className="size-4" />
        Video aufnehmen
      </Button>
    );
  }

  const canSwitchSource = stage === "live";

  return createPortal(
    // Portaled straight to <body>: this recorder is opened from inside a
    // shadcn Dialog, whose content box is CSS-transformed for centering -
    // any transformed ancestor becomes the containing block for `position:
    // fixed` descendants, so without the portal this would be pinned to
    // that small dialog box instead of the actual viewport. It renders as a
    // centered modal over a dimmed backdrop - like the trimmer - not a
    // fullscreen takeover.
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-md sm:p-8">
      <div className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/60">
        <button
          type="button"
          aria-label="Rekorder schließen"
          onClick={closeRecorder}
          className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        >
          <XIcon className="size-5" />
        </button>

        {stage === "source" && (
          <div className="flex flex-col items-center gap-8 px-6 py-14 sm:px-10">
            <div className="text-center">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Wähle die Aufnahmequelle</h2>
              <p className="mt-1.5 text-sm text-white/50">Du kannst die Quelle jederzeit wechseln.</p>
            </div>
            {errorMsg && (
              <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 ring-1 ring-red-500/30">
                {errorMsg}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-5">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => chooseSource(opt.key)}
                  className="group flex w-36 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-black/30"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
                    <opt.icon className="size-6" />
                  </span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(stage === "live" || stage === "countdown" || stage === "recording") && (
          <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "16 / 9" }}>
            {source === "camera" && (
              <video
                ref={camVideoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${mirrorCamera ? "scale-x-[-1]" : ""}`}
              />
            )}
            {source === "screen" && (
              <video ref={screenVideoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
            )}
            {source === "both" && (
              <>
                <canvas ref={canvasRef} className="h-full w-full object-contain" />
                <video ref={screenVideoRef} autoPlay muted playsInline className="absolute -left-[9999px] h-px w-px" />
                <video ref={camVideoRef} autoPlay muted playsInline className="absolute -left-[9999px] h-px w-px" />
              </>
            )}

            {stage === "countdown" && countdownValue !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="flex size-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-2xl">
                  {countdownValue}
                </div>
              </div>
            )}
          </div>
        )}

        {stage === "preview" && recordedUrl && (
          <div className="flex flex-col items-center gap-6 p-6 sm:p-8">
            <div
              className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-black"
              style={{ aspectRatio: "16 / 9" }}
            >
              <video
                src={recordedUrl}
                aria-hidden
                muted
                loop
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
              />
              <video src={recordedUrl} controls autoPlay playsInline className="relative h-full w-full object-contain" />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" variant="destructive" onClick={retry}>
                <RotateCcwIcon className="size-4" />
                Nochmal versuchen
              </Button>
              <VideoTrimmer videoUrl={recordedUrl} fileName="aufnahme.webm" onTrimmed={handleTrimmed} />
              <Button type="button" onClick={accept}>
                <CheckIcon className="size-4" />
                Übernehmen
              </Button>
            </div>
          </div>
        )}

        {(stage === "live" || stage === "countdown" || stage === "recording") && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-neutral-900/95 px-4 py-4 backdrop-blur sm:justify-between sm:px-6">
          <button
            type="button"
            disabled={!canSwitchSource}
            onClick={() => {
              cleanupMedia();
              setSource(null);
              setStage("source");
            }}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-white/15 disabled:pointer-events-none disabled:opacity-40"
          >
            <LayoutGridIcon className="size-4" />
            Aufnahme-Modus
          </button>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {(source === "camera" || source === "both") && cameraDevices.length > 0 && (
              <select
                value={selectedCamera}
                onChange={(e) => switchCamera(e.target.value)}
                disabled={stage !== "live"}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm disabled:opacity-50"
              >
                {cameraDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="text-black">
                    {d.label || "Kamera"}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              aria-label="Screenshot"
              onClick={takeScreenshot}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/15"
            >
              <ImageDownIcon className="size-5" />
            </button>

            {stage === "live" && (
              <button
                type="button"
                aria-label="Aufnahme starten"
                onClick={startCountdown}
                className="flex size-12 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/30 transition-colors hover:bg-red-500"
              >
                <CircleIcon className="size-5 fill-white" />
              </button>
            )}

            {stage === "recording" && (
              <>
                <button
                  type="button"
                  aria-label="Aufnahme stoppen"
                  onClick={stopRecording}
                  className="flex size-12 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/30 transition-colors hover:bg-red-500"
                >
                  <SquareIcon className="size-4 fill-white" />
                </button>
                <span className="rounded-lg bg-white/10 px-3 py-2 font-mono text-sm tabular-nums">
                  {formatDuration(elapsedSeconds)}
                </span>
                <button
                  type="button"
                  aria-label={isPaused ? "Fortsetzen" : "Pausieren"}
                  onClick={togglePause}
                  className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/15"
                >
                  {isPaused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
                </button>
              </>
            )}

            <button
              type="button"
              aria-label={micMuted ? "Mikrofon einschalten" : "Mikrofon ausschalten"}
              onClick={toggleMic}
              className={`flex size-10 items-center justify-center rounded-full transition-colors ${micMuted ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
            >
              {micMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
            </button>

            {micDevices.length > 0 && (
              <select
                value={selectedMic}
                onChange={(e) => switchMic(e.target.value)}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm"
              >
                {micDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="text-black">
                    {d.label || "Mikrofon"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-white/15"
            >
              <SettingsIcon className="size-4" />
              Einstellungen
            </button>
            {settingsOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-56 rounded-xl border border-white/10 bg-neutral-800 p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => setMirrorCamera((v) => !v)}
                  disabled={source === "screen"}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <FlipHorizontalIcon className="size-4" />
                    Video spiegeln
                  </span>
                  <span
                    className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${mirrorCamera ? "bg-primary" : "bg-white/20"}`}
                  >
                    <span
                      className={`size-4 rounded-full bg-white transition-transform ${mirrorCamera ? "translate-x-4" : ""}`}
                    />
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>,
    document.body,
  );
}
