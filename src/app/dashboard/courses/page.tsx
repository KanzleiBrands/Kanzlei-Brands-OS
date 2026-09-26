import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "./course-thumbnail";
import { NewCourseForm } from "./new-course-form";
import { PublishToggle } from "./publish-toggle";

const CATEGORY_LABELS: Record<string, string> = { ONBOARDING: "Onboarding", TRAINING: "Training" };

export default async function CoursesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isAgency = session.user.role === "AGENCY_ADMIN";

  if (isAgency) {
    const courses = await prisma.course.findMany({
      include: {
        _count: { select: { assignments: true, departmentAssignments: true, modules: true } },
        modules: { select: { _count: { select: { lessons: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return (
      <div className="p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Schulung – Kursverwaltung</h1>
          <NewCourseForm />
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,300px))] gap-4">
          {courses.map((course) => {
            const lessonCount = course.modules.reduce((sum, m) => sum + m._count.lessons, 0);
            return (
              <Card key={course.id} className="overflow-hidden">
                <div className="px-(--card-spacing)">
                  <Link href={`/dashboard/courses/${course.id}`} className="block">
                    <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full rounded-lg" />
                  </Link>
                </div>
                <CardHeader>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <CardTitle className="min-w-0 flex-1 truncate" title={course.title}>
                      {course.title}
                    </CardTitle>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary">{CATEGORY_LABELS[course.category]}</Badge>
                      {course.audience === "INTERNAL" && <Badge variant="outline">Intern</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {course._count.modules} Module · {lessonCount} Lektionen ·{" "}
                    {course.audience === "INTERNAL"
                      ? `${course._count.departmentAssignments} Abteilungen zugewiesen`
                      : `${course._count.assignments} Kunden zugewiesen`}
                  </p>
                  <div className="flex flex-col items-start gap-2">
                    <Link href={`/dashboard/courses/${course.id}`} className="text-sm underline">
                      Kurs verwalten
                    </Link>
                    <PublishToggle courseId={course.id} published={course.published} className="w-full" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {courses.length === 0 && <p className="text-muted-foreground">Noch keine Kurse angelegt.</p>}
        </div>
      </div>
    );
  }

  const isInternalStaff = session.user.role === "AGENCY_STAFF";
  let courseWhere: Prisma.CourseWhereInput = {
    published: true,
    audience: "CLIENT",
    assignments: { some: { organizationId: session.user.organizationId } },
  };
  if (isInternalStaff) {
    const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
    courseWhere = viewer?.department
      ? { published: true, audience: "INTERNAL", departmentAssignments: { some: { department: viewer.department } } }
      : { id: "__none__" }; // kein Fallback-Kurs ohne Abteilung anzeigen
  }

  const courses = await prisma.course.findMany({
    where: courseWhere,
    include: {
      modules: { select: { lessons: { select: { id: true } } } },
      enrollments: {
        where: { userId: session.user.id },
        include: { progress: true },
      },
    },
    orderBy: { category: "asc" },
  });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Meine Kurse</h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,300px))] gap-4">
        {courses.map((course) => {
          const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
          const completed = course.enrollments[0]?.progress.filter((p) => p.completedAt).length ?? 0;
          const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
          return (
            <Link key={course.id} href={`/dashboard/courses/${course.id}`} className="block">
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
        {courses.length === 0 && <p className="text-muted-foreground">Noch keine Kurse verfügbar.</p>}
      </div>
    </div>
  );
}
