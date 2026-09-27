import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { hasCourseAccess } from "@/lib/courses-access";
import { LessonPlayerView } from "@/app/dashboard/courses/lesson-player-view";

export default async function InternalLessonPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>;
}) {
  const { courseId, moduleId, lessonId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course || course.audience !== "INTERNAL") notFound();
  if (session.user.role !== "AGENCY_ADMIN" && !course.published) notFound();
  if (!(await hasCourseAccess(session, course))) notFound();

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
    <LessonPlayerView
      course={course}
      currentModule={currentModule}
      lesson={lesson}
      nextLesson={nextLesson}
      completedLessonIds={completedLessonIds}
      basePath="/dashboard/intern/schulung"
    />
  );
}
