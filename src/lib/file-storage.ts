import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Stores an uploaded file under the given folder and returns its public URL.
 * Uses Vercel Blob when configured (production); falls back to writing into
 * public/uploads for local development so the feature is testable without
 * cloud credentials.
 */
export async function storeFile(file: File, folder: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const filename = `${randomUUID()}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${folder}/${filename}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(process.cwd(), "public", "uploads", filename), buffer);
  return `/uploads/${filename}`;
}

function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const filenameParam = parsed.searchParams.get("filename");
    if (filenameParam) return filenameParam;
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last || "upload";
  } catch {
    return "upload";
  }
}

/**
 * Perspektive's own upload links (uploads.leadnotifications.co/download/<id>)
 * are an HTML page that loads the actual file client-side via JS, not a
 * direct file URL - `fetch`-ing it server-side just returns that HTML shell.
 * The page itself calls this API to get a short-lived, signed S3 URL for the
 * real bytes; we replicate that one call so we can download the file
 * ourselves instead of only linking out to Perspektive's page.
 */
async function resolvePerspektiveUploadUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.hostname !== "uploads.leadnotifications.co") return url;

  const uploadId = parsed.pathname.match(/\/download\/([^/]+)/)?.[1];
  if (!uploadId) return url;

  const apiResponse = await fetch(`https://lemon-tool-api.perspective.co/api/session-uploads/${uploadId}`);
  if (!apiResponse.ok) return url;

  const data = (await apiResponse.json()) as { downloadUrl?: unknown };
  return typeof data.downloadUrl === "string" ? data.downloadUrl : url;
}

/**
 * Downloads a file from an external URL (e.g. a funnel tool's own upload
 * host) and re-hosts it under our own storage, so contacts stay reachable
 * even if the source platform's link expires, and everything opens natively
 * from our domain instead of redirecting out. Throws on failure - callers
 * decide whether to fall back to the original URL.
 */
export async function storeFileFromUrl(url: string, folder: string): Promise<string> {
  const resolvedUrl = await resolvePerspektiveUploadUrl(url);

  const response = await fetch(resolvedUrl);
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const file = new File([arrayBuffer], filenameFromUrl(url), { type: contentType });
  return storeFile(file, folder);
}
