import { getFFmpeg } from "@/lib/ffmpeg-client";

/**
 * Re-wraps a video for fast-start playback (moov atom moved to the front of
 * the file) so browsers can start playing it immediately instead of having
 * to download the whole file first - the fix for raw/imported videos that
 * load extremely slowly. Runs entirely in the browser via the same
 * ffmpeg.wasm engine as the video trimmer (see src/lib/ffmpeg-client.ts),
 * so it needs no server-side video processing infrastructure.
 *
 * Prefers a stream-copy remux (fast, no quality loss) which works whenever
 * the source is already an mp4/mov with web-compatible codecs - the common
 * case for badly-packaged but otherwise fine exports. Falls back to a full
 * re-encode (slower) for anything that can't be copied straight into an mp4
 * container (e.g. a webm recording).
 */
export async function remuxVideoForFastStart(
  sourceUrl: string,
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("Video konnte nicht geladen werden.");
  const sourceBlob = await response.blob();
  const sourceType = sourceBlob.type || "video/mp4";
  const inputExt = sourceType.includes("webm") ? "webm" : sourceType.includes("quicktime") ? "mov" : "mp4";
  const inputName = `input.${inputExt}`;
  const outputName = "output.mp4";
  const data = new Uint8Array(await sourceBlob.arrayBuffer());

  const ffmpeg = await getFFmpeg();
  const onFfmpegProgress = ({ progress }: { progress: number }) =>
    onProgress?.(Math.round(Math.min(1, Math.max(0, progress)) * 100));
  if (onProgress) ffmpeg.on("progress", onFfmpegProgress);

  try {
    await ffmpeg.writeFile(inputName, data);

    let output: Uint8Array | null = null;
    try {
      await ffmpeg.exec(["-i", inputName, "-c", "copy", "-movflags", "+faststart", "-f", "mp4", outputName]);
      const result = await ffmpeg.readFile(outputName);
      if (result instanceof Uint8Array && result.length > 1000) output = result;
      else await ffmpeg.deleteFile(outputName).catch(() => {});
    } catch {
      await ffmpeg.deleteFile(outputName).catch(() => {});
    }

    if (!output) {
      // Stream-copy failed (e.g. a webm source with codecs mp4 can't hold
      // without re-encoding) - fall back to a full re-encode, still
      // fast-start, which works for any input at the cost of more time.
      await ffmpeg.exec(["-i", inputName, "-movflags", "+faststart", "-f", "mp4", outputName]);
      const result = await ffmpeg.readFile(outputName);
      if (!(result instanceof Uint8Array)) throw new Error("Unerwartetes Ausgabeformat.");
      output = result;
    }

    return { blob: new Blob([new Uint8Array(output)], { type: "video/mp4" }), fileName: "optimiert.mp4" };
  } finally {
    if (onProgress) ffmpeg.off("progress", onFfmpegProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
