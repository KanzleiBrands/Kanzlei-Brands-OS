import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewCourseForm } from "./new-course-form";
import { PublishToggle } from "./publish-toggle";

const CATEGORY_LABELS: Record<string, string> = { ONBOARDING: "Onboarding", TRAINING: "Training" };

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAgency = session.user.role === "AGENCY_ADMIN";

  if (isAgency) {
    const courses = await prisma.course.findMany({
      include: { _count: { select: { lessons: true, assignments: true } } },
      orderBy: { createdAt: "desc" },
    });

    return (
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Schulung – Kursverwaltung</h1>
          <NewCourseForm />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{course.title}</CardTitle>
                  <Badge variant="secondary">{CATEGORY_LABELS[course.category]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {course._count.lessons} Lektionen · {course._count.assignments} Kunden zugewiesen
                </p>
                <div className="flex items-center justify-between">
                  <Link href={`/dashboard/courses/${course.id}`} className="text-sm underline">
                    Lektionen verwalten
                  </Link>
                  <PublishToggle courseId={course.id} published={course.published} />
                </div>
              </CardContent>
            </Card>
          ))}
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
      lessons: true,
      enrollments: {
        where: { userId: session.user.id },
        include: { progress: true },
      },
    },
    orderBy: { category: "asc" },
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Schulung</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const totalLessons = course.lessons.length;
          const completed = course.enrollments[0]?.progress.filter((p) => p.completedAt).length ?? 0;
          return (
            <Link key={course.id} href={`/dashboard/courses/${course.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{course.title}</CardTitle>
                    <Badge variant={course.category === "ONBOARDING" ? "default" : "secondary"}>
                      {CATEGORY_LABELS[course.category]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {completed} / {totalLessons} Lektionen abgeschlossen
                  </p>
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
