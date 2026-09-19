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
