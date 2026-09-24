import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { parseLessonBlocks } from "@/lib/lesson-blocks";
import { LessonEditor } from "./lesson-editor";

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>;
}) {
  const { courseId, moduleId, lessonId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect(`/dashboard/courses/${courseId}`);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) notFound();

  return (
    <LessonEditor
      courseId={courseId}
      courseTitle={lesson.module.course.title}
      moduleTitle={lesson.module.title}
      lessonId={lesson.id}
      title={lesson.title}
      description={lesson.description}
      thumbnailUrl={lesson.thumbnailUrl}
      videoUrl={lesson.videoUrl}
      pdfUrl={lesson.pdfUrl}
      notionUrl={lesson.notionUrl}
      initialBlocks={parseLessonBlocks(lesson.content)}
    />
  );
}
