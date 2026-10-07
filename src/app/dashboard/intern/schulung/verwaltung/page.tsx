import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseThumbnail } from "@/app/dashboard/courses/course-thumbnail";
import { NewCourseForm } from "@/app/dashboard/courses/new-course-form";
import { PublishToggle } from "@/app/dashboard/courses/publish-toggle";
import { canManageInternalCourses } from "@/lib/course-manager-access";

/**
 * Verwaltung der internen Mitarbeiterschulungen (audience=INTERNAL) -
 * bewusst komplett getrennt von /dashboard/courses (Kunden-Kursverwaltung)
 * und nur für Super-Admin und Kursmanager sichtbar (siehe
 * canManageInternalCourses). Vorher konnte jeder Fulfillment-AGENCY_ADMIN
 * über die geteilte Kursverwaltung auch interne Kurse anderer Abteilungen
 * (z.B. eine Vertriebsschulung) einsehen und bearbeiten.
 */
export default async function InternalCourseAdminPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!(await canManageInternalCourses(session))) redirect("/dashboard/intern/schulung");

  const courses = await prisma.course.findMany({
    where: { audience: "INTERNAL" },
    include: {
      _count: { select: { userAssignments: true, modules: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Interne Schulungen verwalten</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/intern/schulung/verwaltung/video-import" className="text-sm underline">
            Video-Import
          </Link>
          <NewCourseForm audience="INTERNAL" />
        </div>
      </div>
      <p className="mb-6 text-muted-foreground">
        Mitarbeiterzuweisung erfolgt direkt auf der jeweiligen Schulung selbst (Tab &bdquo;Mitglieder&ldquo;).
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,300px))] gap-4">
        {courses.map((course) => {
          const lessonCount = course.modules.reduce((sum, m) => sum + m._count.lessons, 0);
          return (
            <Card key={course.id} className="overflow-hidden">
              <div className="px-(--card-spacing)">
                <Link href={`/dashboard/courses/${course.id}?manage=1`} className="block">
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full rounded-lg" />
                </Link>
              </div>
              <CardHeader>
                <CardTitle className="truncate" title={course.title}>
                  {course.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {course._count.modules} Module · {lessonCount} Lektionen · {course._count.userAssignments} Mitarbeiter zugewiesen
                </p>
                <div className="flex flex-col items-start gap-2">
                  <Link href={`/dashboard/courses/${course.id}?manage=1`} className="text-sm underline">
                    Kurs verwalten
                  </Link>
                  <PublishToggle courseId={course.id} published={course.published} className="w-full" />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {courses.length === 0 && <p className="text-muted-foreground">Noch keine internen Kurse angelegt.</p>}
      </div>
    </div>
  );
}
