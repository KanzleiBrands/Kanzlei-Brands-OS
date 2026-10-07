import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { hasCourseAccess } from "@/lib/courses-access";
import { canManageCourse } from "@/lib/actions/courses";
import { ModuleDetailView } from "../../../module-detail-view";

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

  const courseModule = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: true,
      lessons: { orderBy: { order: "asc" } },
    },
  });
  if (!courseModule || courseModule.courseId !== courseId) notFound();

  // Wer den Kurs verwalten darf (Agentur-Admin für CLIENT, Super-Admin/
  // Kursmanager für INTERNAL - siehe canManageCourse) landet ohne ?preview=1
  // im Builder statt hier; mit ?preview=1 sieht er dieselbe Lerner-Ansicht wie
  // ein zugewiesener Nutzer, auch für einen noch unveröffentlichten Kurs.
  const canManage = await canManageCourse(session, courseModule.course.audience);
  const isPreview = canManage && preview === "1";
  if (canManage && !isPreview) redirect(`/dashboard/courses/${courseId}?manage=1`);
  if (!courseModule.course.published && !isPreview) notFound();

  if (!isPreview && !(await hasCourseAccess(session, courseModule.course))) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { progress: true },
  });
  const completedLessonIds = new Set(
    (enrollment?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );

  return (
    <ModuleDetailView
      courseModule={courseModule}
      completedLessonIds={completedLessonIds}
      basePath="/dashboard/courses"
      isPreview={isPreview}
    />
  );
}
