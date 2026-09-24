import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2Icon, CircleIcon, PlayCircleIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "../../../course-thumbnail";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect(`/dashboard/courses/${courseId}`);

  const courseModule = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: true,
      lessons: { orderBy: { order: "asc" } },
    },
  });
  if (!courseModule || courseModule.courseId !== courseId || !courseModule.course.published) notFound();

  const assigned = await prisma.courseAssignment.findFirst({
    where: { courseId, organizationId: session.user.organizationId },
  });
  if (!assigned) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { progress: true },
  });
  const completedLessonIds = new Set(
    (enrollment?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );
  const completedCount = courseModule.lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const percent = courseModule.lessons.length > 0 ? (completedCount / courseModule.lessons.length) * 100 : 0;

  return (
    <div className="p-4 sm:p-8">
      <BackLink href={`/dashboard/courses/${courseId}`}>Zurück zur Kursübersicht</BackLink>

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
              href={`/dashboard/courses/${courseId}/module/${moduleId}/lesson/${lesson.id}`}
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
