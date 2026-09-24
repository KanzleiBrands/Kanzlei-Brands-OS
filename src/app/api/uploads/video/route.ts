import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";

/**
 * Authorizes and brokers direct-from-browser video uploads to Vercel Blob.
 * The video bytes never pass through our own server (no Server Action body
 * limit, no Vercel Function payload limit) - the browser uploads straight to
 * Blob storage using a short-lived token this route hands out, in chunks
 * that scale to any file size. See lesson-video-upload.tsx for the client
 * side of this flow.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const session = await requireSession();
    if (session.user.role !== "AGENCY_ADMIN") {
      return NextResponse.json({ error: "Nur Agentur-Admins können Videos hochladen." }, { status: 403 });
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*"],
        addRandomSuffix: true,
        maximumSizeInBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      }),
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[api/uploads/video] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload fehlgeschlagen." },
      { status: 400 },
    );
  }
}
