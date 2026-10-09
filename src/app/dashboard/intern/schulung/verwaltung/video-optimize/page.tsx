import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canManageInternalCourses } from "@/lib/course-manager-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { VideoOptimizeTable, type VideoOptimizeRow } from "./video-optimize-table";

/**
 * Behebt extrem langsam ladende Lektionsvideos: viele ältere/importierte
 * Videos (siehe video-import) sind rohe, unverpackte Dateien, deren
 * moov-Atom oft am Dateiende statt am Anfang liegt - Browser müssen dann
 * erst die GESAMTE Datei laden, bevor überhaupt etwas abspielt. Diese Seite
 * verpackt jede Lektion mit Video client-seitig per ffmpeg.wasm (gleiche
 * Engine wie der Video-Trimmer, siehe video-optimize-client.ts) für
 * sofortiges Abspielen neu und lädt das Ergebnis über denselben Weg wie
 * neue Videos wieder hoch.
 */
export default async function VideoOptimizePage() {
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

  const rows: VideoOptimizeRow[] = courses.flatMap((course) =>
    course.modules.flatMap((courseModule) =>
      courseModule.lessons
        .filter((lesson) => !!lesson.videoUrl)
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          courseTitle: course.title,
          moduleTitle: courseModule.title,
          videoUrl: lesson.videoUrl as string,
          optimizedAt: lesson.videoOptimizedAt?.toISOString() ?? null,
        })),
    ),
  );

  const openCount = rows.filter((r) => !r.optimizedAt).length;

  return (
    <div className="p-4 sm:p-8">
      <BackLink href="/dashboard/intern/schulung/verwaltung">Zurück zur Kursverwaltung</BackLink>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">Video-Optimierung</h1>
      <p className="mb-6 text-muted-foreground">
        Rohe, unverpackte Videos können extrem langsam laden, weil der Browser oft die gesamte Datei laden muss,
        bevor überhaupt etwas abspielt. Dieser Schritt verpackt jedes Video für sofortiges Abspielen neu - läuft
        direkt in deinem Browser, ohne Qualitätsverlust bei den meisten Dateien.
      </p>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Keine Lektionen mit Video gefunden.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {rows.length} Video{rows.length === 1 ? "" : "s"} insgesamt - {openCount} noch nicht optimiert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VideoOptimizeTable rows={rows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
