import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
}

export default async function CourseProgressPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard/courses");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: { include: { lessons: { select: { id: true } } } },
      assignments: {
        include: {
          organization: {
            include: {
              users: {
                where: { role: { in: ["CLIENT_ADMIN", "CLIENT_STAFF"] } },
                orderBy: { name: "asc" },
                include: {
                  enrollments: {
                    where: { courseId },
                    include: { progress: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { organization: { name: "asc" } },
      },
    },
  });
  if (!course) notFound();

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);

  return (
    <div className="p-4 sm:p-8">
      <BackLink href={`/dashboard/courses/${course.id}`}>Zurück zum Kurs</BackLink>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold">Lernfortschritt – {course.title}</h1>
        <p className="text-muted-foreground">
          {totalLessons} Lektionen · {course.assignments.length} Kunden zugewiesen
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {course.assignments.map(({ organization }) => (
          <Card key={organization.id}>
            <CardHeader>
              <CardTitle>{organization.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {organization.users.map((user) => {
                const enrollment = user.enrollments[0];
                const completedCount = enrollment?.progress.filter((p) => p.completedAt).length ?? 0;
                const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
                const lastActivity = enrollment?.progress
                  .filter((p) => p.completedAt)
                  .map((p) => p.completedAt as Date)
                  .sort((a, b) => b.getTime() - a.getTime())[0];

                return (
                  <div key={user.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {completedCount} / {totalLessons} Lektionen
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lastActivity ? `Zuletzt aktiv: ${formatDate(lastActivity)}` : "Noch nicht gestartet"}
                        </p>
                      </div>
                      <div className="flex w-32 flex-col items-end gap-1">
                        <span className="text-sm font-semibold">{percent}%</span>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {organization.users.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine Nutzer bei diesem Kunden.</p>
              )}
            </CardContent>
          </Card>
        ))}
        {course.assignments.length === 0 && (
          <p className="text-muted-foreground">
            Dieser Kurs ist noch keinem Kunden zugewiesen. Weise ihn unter den Kundeneinstellungen zu, um hier Fortschritt
            zu sehen.
          </p>
        )}
      </div>
    </div>
  );
}
