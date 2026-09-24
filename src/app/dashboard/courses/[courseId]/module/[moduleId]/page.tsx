import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2Icon, CircleIcon, EyeIcon, PlayCircleIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "../../../course-thumbnail";

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

      <div className="mt-2 mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-xl border bg-card p-4">
        <div className="flex items-center gap-4">
          <CourseThumbnail src={courseModule.thumbnailUrl} alt={courseModule.title} className="h-20 w-32 shrink-0 rounded-lg" />
          <div>
            <p className="text-sm text-muted-foreground uppercase">{courseModule.course.title}</p>
            <h1 className="text-xl font-semibold">{courseModule.title}</h1>
            {courseModule.description && <p className="mt-1 text-sm text-muted-foreground">{courseModule.description}</p>}
          </div>
        </div>
        <CircularProgress percent={percent} size="lg" />
      </div>

      <div className="flex flex-col gap-2">
        {courseModule.lessons.map((lesson, index) => {
          const completed = completedLessonIds.has(lesson.id);
          return (
            <Link
              key={lesson.id}
              href={`/dashboard/courses/${courseId}/module/${moduleId}/lesson/${lesson.id}${previewQuery}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary"
            >
              {completed ? (
                <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
              ) : (
                <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
              )}
              <PlayCircleIcon className="size-5 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{index + 1}.</span>
              <span className="font-medium">{lesson.title}</span>
            </Link>
          );
        })}
        {courseModule.lessons.length === 0 && <p className="text-muted-foreground">Noch keine Lektionen.</p>}
      </div>
    </div>
  );
}
