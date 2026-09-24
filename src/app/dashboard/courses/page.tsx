import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      include: { _count: { select: { assignments: true, modules: true } }, modules: { select: { _count: { select: { lessons: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return (
      <div className="p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Schulung – Kursverwaltung</h1>
          <NewCourseForm />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const lessonCount = course.modules.reduce((sum, m) => sum + m._count.lessons, 0);
            return (
              <Card key={course.id} className="overflow-hidden py-0">
                <Link href={`/dashboard/courses/${course.id}`} className="block">
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="h-32 w-full" />
                </Link>
                <CardHeader className="pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>{course.title}</CardTitle>
                    <Badge variant="secondary">{CATEGORY_LABELS[course.category]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {course._count.modules} Module · {lessonCount} Lektionen · {course._count.assignments} Kunden zugewiesen
                  </p>
                  <div className="flex items-center justify-between">
                    <Link href={`/dashboard/courses/${course.id}`} className="text-sm underline">
                      Kurs verwalten
                    </Link>
                    <PublishToggle courseId={course.id} published={course.published} />
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

  const courses = await prisma.course.findMany({
    where: {
      published: true,
      assignments: { some: { organizationId: session.user.organizationId } },
    },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
          const completed = course.enrollments[0]?.progress.filter((p) => p.completedAt).length ?? 0;
          const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
          return (
            <Link key={course.id} href={`/dashboard/courses/${course.id}`} className="block">
              <Card className="overflow-hidden py-0 transition-colors hover:border-primary">
                <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="h-36 w-full" />
                <CardContent className="flex flex-col gap-1 py-4">
                  <p className="font-medium">{course.title}</p>
                  <p className="text-sm font-medium text-emerald-600">{percent}% FORTSCHRITT</p>
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
