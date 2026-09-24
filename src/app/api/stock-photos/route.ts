import { NextResponse } from "next/server";
import { requireSession } from "@/lib/access";
import { searchPixabayPhotos } from "@/lib/pixabay";

/** Searches free stock photos (Pixabay) for the course-thumbnail generator's background picker. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    if (session.user.role !== "AGENCY_ADMIN") {
      return NextResponse.json({ error: "Nur Agentur-Admins können Stock-Fotos suchen." }, { status: 403 });
    }

    const query = new URL(request.url).searchParams.get("q") ?? "";
    const photos = await searchPixabayPhotos(query);
    return NextResponse.json({ photos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suche fehlgeschlagen." },
      { status: 400 },
    );
  }
}
