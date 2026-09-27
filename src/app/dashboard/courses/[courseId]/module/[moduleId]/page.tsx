import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { hasCourseAccess } from "@/lib/courses-access";
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

  const isAgency = session.user.role === "AGENCY_ADMIN";
  // CLIENT-Kurse: Admins landen im Builder statt hier (Vorschau via ?preview=1
  // ausgenommen). INTERNAL-Kurse laufen primär über
  // /dashboard/intern/schulung/[courseId]/module/[moduleId] - diese Seite ist
  // hier nur der Fallback für alte Links/Bookmarks.
  const isInternalCourse = courseModule.course.audience === "INTERNAL";
  const isPreview = isAgency && !isInternalCourse && preview === "1";
  if (isAgency && !isInternalCourse && !isPreview) redirect(`/dashboard/courses/${courseId}?manage=1`);
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
