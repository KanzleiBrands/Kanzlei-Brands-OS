import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { hasCourseAccess } from "@/lib/courses-access";
import { ModuleDetailView } from "@/app/dashboard/courses/module-detail-view";

export default async function InternalModuleDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const courseModule = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: true,
      lessons: { orderBy: { order: "asc" } },
    },
  });
  if (!courseModule || courseModule.courseId !== courseId || courseModule.course.audience !== "INTERNAL") notFound();
  if (session.user.role !== "AGENCY_ADMIN" && !courseModule.course.published) notFound();
  if (!(await hasCourseAccess(session, courseModule.course))) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { progress: true },
  });
  const completedLessonIds = new Set(
    (enrollment?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );

  return (
    <ModuleDetailView courseModule={courseModule} completedLessonIds={completedLessonIds} basePath="/dashboard/intern/schulung" />
  );
}
