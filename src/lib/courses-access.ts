import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";

type CourseAudience = "CLIENT" | "INTERNAL";

/**
 * Prüft echten Zugriff auf einen Kurs jenseits der reinen Listen-Filterung -
 * CLIENT-Kurse über CourseAssignment (Organisation), INTERNAL-Kurse über
 * CourseDepartmentAssignment (Abteilung des Nutzers). Interne Kurse sind
 * bewusst vom Kunden-Kursbereich entkoppelt: AGENCY_ADMIN ist hier KEIN
 * Freifahrtschein mehr (das hätte z.B. jedem Fulfillment-Mitarbeiter Zugriff
 * auf eine interne Vertriebsschulung gegeben, die nicht für ihn bestimmt
 * ist) - nur der Super-Admin sieht jeden internen Kurs, alle anderen nur
 * die ihrer eigenen zugewiesenen Abteilung(en).
 */
export async function hasCourseAccess(
  session: { user: { id: string; email: string; role: string; organizationId: string } },
  course: { id: string; audience: CourseAudience },
): Promise<boolean> {
  if (course.audience === "INTERNAL") {
    if (isSuperAdmin(session.user.email)) return true;
    const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departments: true } });
    if (!viewer?.departments.length) return false;
    const assigned = await prisma.courseDepartmentAssignment.findFirst({
      where: { courseId: course.id, department: { in: viewer.departments } },
    });
    return !!assigned;
  }

  const assigned = await prisma.courseAssignment.findFirst({
    where: { courseId: course.id, organizationId: session.user.organizationId },
  });
  return !!assigned;
}
