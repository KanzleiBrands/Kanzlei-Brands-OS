import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { hasCourseAccess } from "@/lib/courses-access";
import { CourseDetailLearnerView } from "@/app/dashboard/courses/course-detail-learner-view";

/**
 * Eigene Kurs-Detailseite fürs interne Portal, komplett getrennt von
 * /dashboard/courses/[courseId] (Kunden-Kursverwaltung) - bleibt dabei
 * innerhalb von /dashboard/intern, damit die interne Portal-Navigation beim
 * Lernen erhalten bleibt. Rendert dieselbe geteilte Lerner-Ansicht wie die
 * Kunden-Seite, nur mit basePath hierher statt nach /dashboard/courses.
 */
export default async function InternalCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
      enrollments: { where: { userId: session.user.id }, include: { progress: true } },
    },
  });
  if (!course || course.audience !== "INTERNAL") notFound();
  if (session.user.role !== "AGENCY_ADMIN" && !course.published) notFound();
  if (!(await hasCourseAccess(session, course))) notFound();

  return <CourseDetailLearnerView course={course} basePath="/dashboard/intern/schulung" />;
}
