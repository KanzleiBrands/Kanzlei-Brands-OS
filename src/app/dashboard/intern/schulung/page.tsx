import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "@/app/dashboard/courses/course-thumbnail";

/**
 * Eigene, vom Kundenportal getrennte Schulungsansicht fürs interne Portal -
 * zeigt ausschließlich audience=INTERNAL Kurse (Abteilungs- statt
 * Kunden-Zuweisung), damit Mitarbeiterschulung nie mit der
 * Kunden-Schulung vermischt. Kurs-/Modul-/Lektionsansicht selbst bleibt
 * dieselbe geteilte Implementierung unter /dashboard/courses/[courseId] -
 * Verbesserungen dort gelten also für beide Instanzen.
 */
export default async function InternalSchulungPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isAgencyAdmin = session.user.role === "AGENCY_ADMIN";

  let courseWhere: Prisma.CourseWhereInput;
  if (isAgencyAdmin) {
    // Admins haben oft keine feste Abteilung - sehen daher alle internen Kurse.
    courseWhere = { published: true, audience: "INTERNAL" };
  } else {
    const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departments: true } });
    courseWhere = viewer?.departments.length
      ? { published: true, audience: "INTERNAL", departmentAssignments: { some: { department: { in: viewer.departments } } } }
      : { id: "__none__" };
  }

  const courses = await prisma.course.findMany({
    where: courseWhere,
    include: {
      modules: { select: { lessons: { select: { id: true } } } },
      enrollments: { where: { userId: session.user.id }, include: { progress: true } },
    },
    orderBy: { category: "asc" },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Schulung</h1>
        {isAgencyAdmin && (
          <Link href="/dashboard/courses" className="text-sm text-muted-foreground underline underline-offset-2">
            Kurse verwalten
          </Link>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,300px))] gap-4">
        {courses.map((course) => {
          const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
          const completed = course.enrollments[0]?.progress.filter((p) => p.completedAt).length ?? 0;
          const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
          return (
            <Link key={course.id} href={`/dashboard/intern/schulung/${course.id}`} className="block">
              <Card className="overflow-hidden transition-colors hover:border-primary">
                <div className="px-(--card-spacing)">
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full rounded-lg" />
                </div>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate font-medium" title={course.title}>
                    {course.title}
                  </p>
                  <CircularProgress percent={percent} size="sm" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {courses.length === 0 && <p className="text-muted-foreground">Noch keine internen Kurse verfügbar.</p>}
      </div>
    </div>
  );
}
