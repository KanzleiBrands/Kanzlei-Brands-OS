import { prisma } from "@/lib/prisma";

type CourseAudience = "CLIENT" | "INTERNAL";

/**
 * Prüft echten Zugriff auf einen Kurs jenseits der reinen Listen-Filterung -
 * CLIENT-Kurse über CourseAssignment (Organisation), INTERNAL-Kurse über
 * CourseDepartmentAssignment (Abteilung des Nutzers). Agentur-Admins dürfen
 * jeden internen Kurs sehen (sie haben oft keine feste Abteilung).
 */
export async function hasCourseAccess(
  session: { user: { id: string; role: string; organizationId: string } },
  course: { id: string; audience: CourseAudience },
): Promise<boolean> {
  if (course.audience === "INTERNAL") {
    if (session.user.role === "AGENCY_ADMIN") return true;
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
