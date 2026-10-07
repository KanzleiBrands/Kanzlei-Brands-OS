import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";
import type { AgencyDepartment } from "@prisma/client";

/**
 * Interne Schulungen verwalten/bauen kann der Super-Admin immer, zusätzlich
 * jeder Mitarbeiter, dem diese Zusatzrolle in Einstellungen -> Mitarbeiter
 * vergeben wurde (siehe setCourseManagerRole) - unabhängig von role/
 * departments, genau wie hasCashflowAccess (src/lib/cashflow-access.ts).
 */
export async function canManageInternalCourses(session: { user: { id: string; email: string } }): Promise<boolean> {
  if (isSuperAdmin(session.user.email)) return true;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isCourseManager: true } });
  return user?.isCourseManager ?? false;
}

export type CourseManagerScope = {
  isSuperAdmin: boolean;
  isCourseManager: boolean;
  courseManagerAllDepartments: boolean;
  courseManagerDepartments: AgencyDepartment[];
};

/** Lädt die Kursmanager-Felder des Betrachters einmal, um sie ohne weitere Datenbankzugriffe gegen mehrere Zielmitarbeiter zu prüfen (siehe canAssignDepartment). */
export async function getCourseManagerScope(session: { user: { id: string; email: string } }): Promise<CourseManagerScope> {
  if (isSuperAdmin(session.user.email)) {
    return { isSuperAdmin: true, isCourseManager: true, courseManagerAllDepartments: true, courseManagerDepartments: [] };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isCourseManager: true, courseManagerAllDepartments: true, courseManagerDepartments: true },
  });
  return {
    isSuperAdmin: false,
    isCourseManager: user?.isCourseManager ?? false,
    courseManagerAllDepartments: user?.courseManagerAllDepartments ?? false,
    courseManagerDepartments: user?.courseManagerDepartments ?? [],
  };
}

/**
 * Darf dieser Kursmanager (scope) einem Mitarbeiter mit diesen Abteilungen
 * Zugriff auf eine Schulung zuweisen - bei courseManagerAllDepartments (oder
 * dem Super-Admin) uneingeschränkt, sonst nur bei Überschneidung mit den ihm
 * selbst zugewiesenen Abteilungen. Reine Funktion, damit sie z.B. für eine
 * ganze Mitarbeiterliste ohne N+1-Datenbankzugriffe ausgewertet werden kann.
 */
export function canAssignDepartment(scope: CourseManagerScope, targetDepartments: AgencyDepartment[]): boolean {
  if (scope.isSuperAdmin || scope.courseManagerAllDepartments) return true;
  if (!scope.isCourseManager) return false;
  return targetDepartments.some((d) => scope.courseManagerDepartments.includes(d));
}

/** Datenbank-gestützte Variante von canAssignDepartment für einen einzelnen Zielmitarbeiter (siehe setCourseUserAssignment). */
export async function canAssignCourseUser(
  session: { user: { id: string; email: string } },
  targetUserId: string,
): Promise<boolean> {
  const scope = await getCourseManagerScope(session);
  if (scope.isSuperAdmin || scope.courseManagerAllDepartments) return true;
  if (!scope.isCourseManager) return false;

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { departments: true } });
  if (!target) return false;
  return canAssignDepartment(scope, target.departments);
}
