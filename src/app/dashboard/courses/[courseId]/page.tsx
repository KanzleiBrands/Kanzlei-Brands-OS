import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3Icon, ChevronRightIcon, EyeIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "../course-thumbnail";
import { CourseBanner } from "../course-banner";
import { formatLessonMeta } from "../course-format";
import { AddModuleForm } from "./add-module-form";
import { EditModuleDialog } from "./edit-module-dialog";
import { ModuleRowActions } from "./module-row-actions";
import { AddLessonForm } from "./add-lesson-form";
import { EditLessonDialog } from "./edit-lesson-dialog";
import { LessonRowActions } from "./lesson-row-actions";
import { EditCourseDialog } from "./edit-course-dialog";
import { DeleteCourseButton } from "./delete-course-button";
import { PublishToggle } from "../publish-toggle";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { courseId } = await params;
  const { preview } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isAgency = session.user.role === "AGENCY_ADMIN";
  const isPreview = isAgency && preview === "1";

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
      _count: { select: { assignments: true } },
      enrollments: { where: { userId: session.user.id }, include: { progress: true } },
    },
  });
  if (!course) notFound();
  if (!isAgency && !course.published) notFound();

  if (isAgency && !isPreview) {
    const assignmentCount = course._count.assignments;
    return (
      <div className="p-4 sm:p-8">
        <BackLink href="/dashboard/courses">Zurück zur Kursverwaltung</BackLink>

        <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-40 shrink-0 rounded-lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{course.title}</h1>
                <Badge variant="secondary">{course.category === "ONBOARDING" ? "Onboarding" : "Training"}</Badge>
              </div>
              {course.description && <p className="mt-1 text-muted-foreground">{course.description}</p>}
              <p className="mt-1 text-sm text-muted-foreground">{assignmentCount} Kunden zugewiesen</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/courses/${course.id}?preview=1`} />}
            >
              <EyeIcon className="size-4" />
              Vorschau
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/courses/${course.id}/progress`} />}
            >
              <BarChart3Icon className="size-4" />
              Lernfortschritt
            </Button>
            <PublishToggle courseId={course.id} published={course.published} />
            <EditCourseDialog
              courseId={course.id}
              title={course.title}
              description={course.description}
              category={course.category}
              thumbnailUrl={course.thumbnailUrl}
            />
            <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Module</h2>
          <AddModuleForm courseId={course.id} />
        </div>

        <div className="flex flex-col gap-4">
          {course.modules.map((courseModule, moduleIndex) => (
            <Card key={courseModule.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-3">
                    <CourseThumbnail
                      src={courseModule.thumbnailUrl}
                      alt={courseModule.title}
                      className="w-24 shrink-0 rounded-md"
                    />
                    <div>
                      <CardTitle className="text-base">
                        {moduleIndex + 1}. {courseModule.title}
                      </CardTitle>
                      {courseModule.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{courseModule.description}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">{courseModule.lessons.length} Lektionen</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <EditModuleDialog
                      moduleId={courseModule.id}
                      title={courseModule.title}
                      description={courseModule.description}
                      thumbnailUrl={courseModule.thumbnailUrl}
                    />
                    <ModuleRowActions
                      moduleId={courseModule.id}
                      moduleTitle={courseModule.title}
                      canMoveUp={moduleIndex > 0}
                      canMoveDown={moduleIndex < course.modules.length - 1}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {courseModule.lessons.map((lesson, lessonIndex) => (
                  <div key={lesson.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{lessonIndex + 1}.</span>
                      <span>{lesson.title}</span>
                      {lesson.videoUrl && (
                        <Badge variant="outline" className="text-xs">
                          Video
                        </Badge>
                      )}
                      {lesson.pdfUrl && (
                        <Badge variant="outline" className="text-xs">
                          PDF
                        </Badge>
                      )}
                      {lesson.notionUrl && (
                        <Badge variant="outline" className="text-xs">
                          Notion
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <EditLessonDialog
                        lessonId={lesson.id}
                        title={lesson.title}
                        description={lesson.description}
                        thumbnailUrl={lesson.thumbnailUrl}
                        videoUrl={lesson.videoUrl}
                        pdfUrl={lesson.pdfUrl}
                        notionUrl={lesson.notionUrl}
                      />
                      <LessonRowActions
                        lessonId={lesson.id}
                        lessonTitle={lesson.title}
                        canMoveUp={lessonIndex > 0}
                        canMoveDown={lessonIndex < courseModule.lessons.length - 1}
                      />
                    </div>
                  </div>
                ))}
                {courseModule.lessons.length === 0 && (
                  <p className="text-sm text-muted-foreground">Noch keine Lektionen in diesem Modul.</p>
                )}
                <div className="mt-1">
                  <AddLessonForm moduleId={courseModule.id} />
                </div>
              </CardContent>
            </Card>
          ))}
          {course.modules.length === 0 && (
            <p className="text-muted-foreground">Noch keine Module. Lege das erste Modul an, um Lektionen hinzuzufügen.</p>
          )}
        </div>
      </div>
    );
  }

  // ---- Learner (client) view ----
  const completedLessonIds = new Set(
    (course.enrollments[0]?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
  const overallPercent = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

  const nextLesson = allLessons.find((l) => !completedLessonIds.has(l.id));
  const nextLessonModule = nextLesson ? course.modules.find((m) => m.id === nextLesson.moduleId) : null;

  const previewQuery = isPreview ? "?preview=1" : "";

  return (
    <div className="p-4 sm:p-8">
      {isPreview ? (
        <BackLink href={`/dashboard/courses/${course.id}`}>Zurück zum Builder</BackLink>
      ) : (
        <BackLink href="/dashboard/courses">Zurück zu meinen Kursen</BackLink>
      )}

      {isPreview && (
        <div className="mt-2 mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          <EyeIcon className="size-4 shrink-0" />
          Vorschaumodus - so sieht der Kurs für Kunden aus.
        </div>
      )}

      <div className="mt-2 mb-6">
        <CourseBanner
          thumbnailUrl={course.thumbnailUrl}
          eyebrow="Kurs"
          title={course.title}
          right={<CircularProgress percent={overallPercent} size="lg" tone="onDark" />}
        />
      </div>

      {nextLesson && nextLessonModule && (
        <Link
          href={`/dashboard/courses/${course.id}/module/${nextLessonModule.id}/lesson/${nextLesson.id}${previewQuery}`}
          className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-neutral-900 p-3 pr-4 transition-colors hover:bg-neutral-800"
        >
          <div className="flex min-w-0 items-center gap-3">
            <CourseThumbnail
              src={nextLessonModule.thumbnailUrl}
              alt=""
              className="w-16 shrink-0 rounded-md sm:w-20"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/50 uppercase">Mache direkt weiter!</p>
              <p className="truncate font-medium text-white">{nextLesson.title}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-neutral-900">
            Fortsetzen
            <ChevronRightIcon className="size-4" />
          </span>
        </Link>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-primary" />
        <h2 className="text-lg font-semibold">Module</h2>
      </div>
      <div className="flex flex-col gap-3">
        {course.modules.map((courseModule, moduleIndex) => {
          const moduleLessons = courseModule.lessons;
          const moduleCompleted = moduleLessons.filter((l) => completedLessonIds.has(l.id)).length;
          const modulePercent = moduleLessons.length > 0 ? (moduleCompleted / moduleLessons.length) * 100 : 0;
          const totalDuration = moduleLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
          return (
            <Link
              key={courseModule.id}
              href={`/dashboard/courses/${course.id}/module/${courseModule.id}${previewQuery}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CourseThumbnail
                  src={courseModule.thumbnailUrl}
                  alt={courseModule.title}
                  className="w-28 shrink-0 rounded-lg sm:w-32"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    Modul {moduleIndex + 1} – {courseModule.title}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground uppercase">
                    {formatLessonMeta(moduleLessons.length, totalDuration)}
                  </p>
                </div>
              </div>
              <CircularProgress percent={modulePercent} size="sm" className="shrink-0" />
            </Link>
          );
        })}
        {course.modules.length === 0 && <p className="text-muted-foreground">Noch keine Inhalte in diesem Kurs.</p>}
      </div>
    </div>
  );
}
