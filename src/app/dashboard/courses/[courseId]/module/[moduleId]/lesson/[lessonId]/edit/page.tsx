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

  // Video used to be a fixed field outside the block system - for a lesson
  // that was never opened in the block editor since that change, seed one
  // video block from it so the existing video isn't invisible/lost here.
  // Once saved, Lesson.videoUrl is derived back from the blocks themselves
  // (see updateLesson), so this only ever fires for not-yet-migrated content.
  const initialBlocks = parseLessonBlocks(lesson.content);
  if (lesson.videoUrl && !initialBlocks.some((b) => b.type === "video")) {
    initialBlocks.unshift({ id: `blk_${lesson.id}_video`, type: "video", url: lesson.videoUrl });
  }

  return (
    <LessonEditor
      courseId={courseId}
      courseTitle={lesson.module.course.title}
      moduleTitle={lesson.module.title}
      lessonId={lesson.id}
      title={lesson.title}
      description={lesson.description}
      thumbnailUrl={lesson.thumbnailUrl}
      pdfUrl={lesson.pdfUrl}
      notionUrl={lesson.notionUrl}
      initialBlocks={initialBlocks}
    />
  );
}
