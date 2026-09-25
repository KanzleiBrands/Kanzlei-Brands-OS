import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2Icon, ChevronRightIcon, EyeIcon, FileTextIcon, PlayCircleIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "../../../course-thumbnail";
import { CourseBanner } from "../../../course-banner";
import { formatLessonMeta } from "../../../course-format";

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { courseId, moduleId } = await params;
  const { preview } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const isPreview = session.user.role === "AGENCY_ADMIN" && preview === "1";
  if (session.user.role === "AGENCY_ADMIN" && !isPreview) redirect(`/dashboard/courses/${courseId}`);

  const courseModule = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: true,
      lessons: { orderBy: { order: "asc" } },
    },
  });
  if (!courseModule || courseModule.courseId !== courseId || (!courseModule.course.published && !isPreview)) notFound();

  if (!isPreview) {
    const assigned = await prisma.courseAssignment.findFirst({
      where: { courseId, organizationId: session.user.organizationId },
    });
    if (!assigned) notFound();
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { progress: true },
  });
  const completedLessonIds = new Set(
    (enrollment?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );
  const completedCount = courseModule.lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const percent = courseModule.lessons.length > 0 ? (completedCount / courseModule.lessons.length) * 100 : 0;

  const previewQuery = isPreview ? "?preview=1" : "";

  return (
    <div className="p-4 sm:p-8">
      {isPreview ? (
        <BackLink href={`/dashboard/courses/${courseId}?preview=1`}>Zurück zur Kursübersicht</BackLink>
      ) : (
        <BackLink href={`/dashboard/courses/${courseId}`}>Zurück zur Kursübersicht</BackLink>
      )}

      {isPreview && (
        <div className="mt-2 mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          <EyeIcon className="size-4 shrink-0" />
          Vorschaumodus - so sieht der Kurs für Kunden aus.
        </div>
      )}

      <div className="mt-2 mb-6">
        <CourseBanner
          thumbnailUrl={courseModule.thumbnailUrl}
          eyebrow={courseModule.course.title}
          title={courseModule.title}
          meta={
            courseModule.description ??
            formatLessonMeta(
              courseModule.lessons.length,
              courseModule.lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0),
            )
          }
          right={<CircularProgress percent={percent} size="lg" tone="onDark" />}
        />
      </div>

      <div className="flex flex-col gap-2">
        {courseModule.lessons.map((lesson, index) => {
          const completed = completedLessonIds.has(lesson.id);
          const isNext = !completed && !courseModule.lessons.slice(0, index).some((l) => !completedLessonIds.has(l.id));
          return (
            <Link
              key={lesson.id}
              href={`/dashboard/courses/${courseId}/module/${moduleId}/lesson/${lesson.id}${previewQuery}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-2.5 transition-colors hover:border-primary"
            >
              <CourseThumbnail
                src={lesson.thumbnailUrl ?? courseModule.thumbnailUrl}
                alt=""
                className="w-14 shrink-0 rounded-md sm:w-24"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium break-words">
                  {index + 1}. {lesson.title}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {lesson.videoUrl ? (
                    <PlayCircleIcon className="size-3.5 shrink-0" />
                  ) : (
                    <FileTextIcon className="size-3.5 shrink-0" />
                  )}
                  {lesson.durationSeconds
                    ? `${Math.max(1, Math.round(lesson.durationSeconds / 60))} Min.`
                    : lesson.videoUrl
                      ? "Video"
                      : "Material"}
                </div>
              </div>
              {isNext ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1.5 text-sm font-medium text-white sm:px-3 dark:bg-white dark:text-neutral-900">
                  <span className="hidden sm:inline">Fortsetzen</span>
                  <ChevronRightIcon className="size-4" />
                </span>
              ) : completed ? (
                <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
              ) : (
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
              )}
            </Link>
          );
        })}
        {courseModule.lessons.length === 0 && <p className="text-muted-foreground">Noch keine Lektionen.</p>}
      </div>
    </div>
  );
}
