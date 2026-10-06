import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";

/**
 * Authorizes and brokers direct-from-browser audio uploads to Vercel Blob -
 * same direct-to-blob pattern as /api/uploads/video (see that route for why),
 * kept as its own route rather than sharing one so the allowed content type
 * stays narrow per upload kind.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const session = await requireSession();
    if (session.user.role !== "AGENCY_ADMIN") {
      return NextResponse.json({ error: "Nur Agentur-Admins können Audiodateien hochladen." }, { status: 403 });
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["audio/*"],
        addRandomSuffix: true,
        maximumSizeInBytes: 1 * 1024 * 1024 * 1024, // 1 GB
      }),
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[api/uploads/audio] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload fehlgeschlagen." },
      { status: 400 },
    );
  }
}
