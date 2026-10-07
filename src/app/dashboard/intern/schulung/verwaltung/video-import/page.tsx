import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canManageInternalCourses } from "@/lib/course-manager-access";
import { listVideoImportBlobs } from "@/lib/actions/video-import";
import { matchVideoImportBlobs, VIDEO_IMPORT_PREFIX, type VideoImportLessonCandidate } from "@/lib/video-import-matching";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { VideoImportTable } from "./video-import-table";

/**
 * Bulk-Video-Zuordnung: Admin/Kursmanager lädt Videos direkt in den
 * Vercel-Blob-Store unter `video-import/` hoch (siehe Chat-Anleitung), diese
 * Seite schlägt per Namensabgleich (src/lib/video-import-matching.ts) die
 * passende Lektion vor. Nichts wird automatisch übernommen - die Zuordnung
 * muss hier erst bestätigt werden (siehe applyVideoImportMapping).
 */
export default async function VideoImportPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isAgency = session.user.role === "AGENCY_ADMIN";
  const canManageInternal = await canManageInternalCourses(session);
  if (!isAgency && !canManageInternal) redirect("/dashboard/intern/schulung");

  const courses = await prisma.course.findMany({
    where: isAgency ? {} : { audience: "INTERNAL" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: { title: "asc" },
  });

  const lessons: VideoImportLessonCandidate[] = courses.flatMap((course) =>
    course.modules.flatMap((courseModule) =>
      courseModule.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        courseTitle: course.title,
        moduleTitle: courseModule.title,
        audience: course.audience,
        hasVideo: !!lesson.videoUrl,
      })),
    ),
  );

  let blobs: Awaited<ReturnType<typeof listVideoImportBlobs>> = [];
  let loadError: string | null = null;
  try {
    blobs = await listVideoImportBlobs();
  } catch {
    loadError = "Blob-Storage konnte nicht gelesen werden. Ist BLOB_READ_WRITE_TOKEN konfiguriert?";
  }

  const matches = matchVideoImportBlobs(blobs, lessons);

  return (
    <div className="p-4 sm:p-8">
      <BackLink href="/dashboard/intern/schulung/verwaltung">Zurück zur Kursverwaltung</BackLink>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">Video-Import</h1>
      <p className="mb-6 text-muted-foreground">
        Lade Videos direkt im{" "}
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Vercel-Dashboard
        </a>{" "}
        unter dem Pfad <code className="rounded bg-muted px-1 py-0.5 text-xs">{VIDEO_IMPORT_PREFIX}</code> in den
        Blob-Store hoch. Diese Seite schlägt dir anhand des Dateinamens die passende Lektion vor - übernommen wird
        erst, wenn du unten bestätigst.
      </p>

      {loadError ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : blobs.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Noch keine Dateien unter <code className="rounded bg-muted px-1 py-0.5 text-xs">{VIDEO_IMPORT_PREFIX}</code>{" "}
            gefunden. Lade zuerst Videos hoch und lade die Seite neu.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {blobs.length} Datei{blobs.length === 1 ? "" : "en"} gefunden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VideoImportTable matches={matches} lessons={lessons} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
