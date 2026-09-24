import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2Icon, CircleIcon, FileTextIcon, ChevronRightIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { LessonCompleteButton } from "./lesson-complete-button";

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>;
}) {
  const { courseId, moduleId, lessonId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "AGENCY_ADMIN") redirect(`/dashboard/courses/${courseId}`);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course || !course.published) notFound();

  const assigned = await prisma.courseAssignment.findFirst({
    where: { courseId, organizationId: session.user.organizationId },
  });
  if (!assigned) notFound();

  const currentModule = course.modules.find((m) => m.id === moduleId);
  const lesson = currentModule?.lessons.find((l) => l.id === lessonId);
  if (!currentModule || !lesson) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { progress: true },
  });
  const completedLessonIds = new Set(
    (enrollment?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );

  const allLessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const nextLesson = allLessons[currentIndex + 1];

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:p-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href={`/dashboard/courses/${course.id}`} className="hover:underline">
            {course.title}
          </Link>
          <ChevronRightIcon className="size-3.5" />
          <Link href={`/dashboard/courses/${course.id}/module/${currentModule.id}`} className="hover:underline">
            {currentModule.title}
          </Link>
          <ChevronRightIcon className="size-3.5" />
          <span>{lesson.title}</span>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h1 className="mb-3 text-xl font-semibold">{lesson.title}</h1>

          {lesson.videoUrl ? (
            <video src={lesson.videoUrl} controls className="w-full rounded-lg bg-black" />
          ) : lesson.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lesson.thumbnailUrl} alt={lesson.title} className="w-full rounded-lg object-cover" />
          ) : null}

          {lesson.description && <p className="mt-4 text-sm text-muted-foreground">{lesson.description}</p>}

          {(lesson.pdfUrl || lesson.notionUrl) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {lesson.pdfUrl && (
                <a
                  href={lesson.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:border-primary"
                >
                  <FileTextIcon className="size-4" />
                  PDF öffnen
                </a>
              )}
              {lesson.notionUrl && (
                <a
                  href={lesson.notionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:border-primary"
                >
                  <FileTextIcon className="size-4" />
                  Notion-Doc öffnen
                </a>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <LessonCompleteButton lessonId={lesson.id} completed={completedLessonIds.has(lesson.id)} />
            {nextLesson && (
              <Link
                href={`/dashboard/courses/${course.id}/module/${nextLesson.moduleId}/lesson/${nextLesson.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Nächste Lektion
                <ChevronRightIcon className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <p className="mb-2 px-1 text-sm font-semibold">{currentModule.title}</p>
        <div className="flex flex-col gap-1">
          {currentModule.lessons.map((l, index) => {
            const completed = completedLessonIds.has(l.id);
            const active = l.id === lessonId;
            return (
              <Link
                key={l.id}
                href={`/dashboard/courses/${course.id}/module/${currentModule.id}/lesson/${l.id}`}
                className={`flex items-center gap-2 rounded-md p-2 text-sm transition-colors ${
                  active ? "border border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                {completed ? (
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="line-clamp-2">{l.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
