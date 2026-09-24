import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";

const ALLOWED_HOST = /(^|\.)pixabay\.com$/;

/**
 * Re-serves a Pixabay image from our own origin. Pixabay's CDN doesn't send
 * CORS headers, so loading it directly into an <img> would taint the
 * thumbnail-generator canvas and block toBlob()/toDataURL() - proxying the
 * bytes through our own domain keeps the canvas same-origin and exportable.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    if (session.user.role !== "AGENCY_ADMIN") {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return NextResponse.json({ error: "Fehlende Bild-URL." }, { status: 400 });
    }

    const parsed = new URL(target);
    if (parsed.protocol !== "https:" || !ALLOWED_HOST.test(parsed.hostname)) {
      return NextResponse.json({ error: "Ungültige Bildquelle." }, { status: 400 });
    }

    const response = await fetch(parsed.toString());
    if (!response.ok) {
      return NextResponse.json({ error: "Bild konnte nicht geladen werden." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: { "content-type": contentType, "cache-control": "public, max-age=86400" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bild konnte nicht geladen werden." },
      { status: 400 },
    );
  }
}
