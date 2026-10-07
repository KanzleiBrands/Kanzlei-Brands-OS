import { prisma } from "@/lib/prisma";
import { canManageInternalCourses } from "@/lib/course-manager-access";

type CourseAudience = "CLIENT" | "INTERNAL";

/**
 * Prüft echten Zugriff auf einen Kurs jenseits der reinen Listen-Filterung -
 * CLIENT-Kurse über CourseAssignment (Organisation), INTERNAL-Kurse über
 * CourseUserAssignment (einzelner Mitarbeiter). Interne Kurse sind bewusst
 * vom Kunden-Kursbereich entkoppelt: AGENCY_ADMIN ist hier KEIN Freifahrtschein
 * mehr (das hätte z.B. jedem Fulfillment-Mitarbeiter Zugriff auf eine interne
 * Vertriebsschulung gegeben, die nicht für ihn bestimmt ist) - nur der
 * Super-Admin und Kursmanager (siehe canManageInternalCourses) sehen jeden
 * internen Kurs, alle anderen nur die ihnen direkt zugewiesenen.
 */
export async function hasCourseAccess(
  session: { user: { id: string; email: string; role: string; organizationId: string } },
  course: { id: string; audience: CourseAudience },
): Promise<boolean> {
  if (course.audience === "INTERNAL") {
    if (await canManageInternalCourses(session)) return true;
    const assigned = await prisma.courseUserAssignment.findFirst({
      where: { courseId: course.id, userId: session.user.id },
    });
    return !!assigned;
  }

  const assigned = await prisma.courseAssignment.findFirst({
    where: { courseId: course.id, organizationId: session.user.organizationId },
  });
  return !!assigned;
}
