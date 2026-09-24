let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

/**
 * Lazily loads a single shared ffmpeg.wasm instance from our own origin
 * (public/ffmpeg/, copied from node_modules by scripts/copy-ffmpeg-core.js
 * at install time) so the video trimmer never depends on a CDN. Loaded once
 * per page session and reused across trimmer opens.
 */
export async function getFFmpeg(onLog?: (message: string) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));
      await ffmpeg.load({
        coreURL: "/ffmpeg/ffmpeg-core.js",
        wasmURL: "/ffmpeg/ffmpeg-core.wasm",
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}
