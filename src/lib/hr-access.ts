import type { AbsenceAllowanceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Personal (HR) gilt für alle Agentur-Mitarbeiter (AGENCY_ADMIN + AGENCY_STAFF),
 * nie für Kunden - siehe /dashboard/intern/personal.
 */
export function isAgencyMember(role: string): boolean {
  return role === "AGENCY_ADMIN" || role === "AGENCY_STAFF";
}

/** Nur AGENCY_ADMIN darf Mitarbeiterdaten/Personalakte/Kontingente/Firmendaten pflegen. */
export function requireHrAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Nur Agentur-Admins können den Personal-Bereich verwalten.");
}

/**
 * "Manager und höher": true, wenn managerId (direkt oder über mehrere Ebenen)
 * irgendwann bei viewerId ankommt - läuft die Kette bis maximal 10 Ebenen hoch
 * (schützt vor einer versehentlichen Zyklus-Endlosschleife).
 */
export async function isInManagerChainOf(viewerId: string, targetUserId: string): Promise<boolean> {
  let currentId: string = targetUserId;
  for (let i = 0; i < 10; i++) {
    const current: { managerId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { managerId: true },
    });
    if (!current?.managerId) return false;
    if (current.managerId === viewerId) return true;
    currentId = current.managerId;
  }
  return false;
}

/** AGENCY_ADMIN darf immer; ein Manager darf für seine (auch indirekten) Berichtenden. */
export async function canApproveAbsenceFor(session: Session, targetUserId: string): Promise<boolean> {
  if (session.user.role === "AGENCY_ADMIN") return true;
  if (session.user.id === targetUserId) return false;
  return isInManagerChainOf(session.user.id, targetUserId);
}

/**
 * Wer über einen neuen Abwesenheitsantrag von `employee` informiert werden
 * soll - laut Organigramm die direkte Führungskraft (managerId), oder ohne
 * eine solche (z.B. die GF an der Spitze) alle anderen Agentur-Admins.
 */
export async function getAbsenceApprovers(employee: {
  id: string;
  managerId: string | null;
  organizationId: string;
}): Promise<{ id: string; name: string; email: string }[]> {
  if (employee.managerId) {
    const manager = await prisma.user.findUnique({
      where: { id: employee.managerId },
      select: { id: true, name: true, email: true },
    });
    return manager ? [manager] : [];
  }
  return prisma.user.findMany({
    where: { organizationId: employee.organizationId, role: "AGENCY_ADMIN", id: { not: employee.id } },
    select: { id: true, name: true, email: true },
  });
}

/** Alle (auch indirekten) Berichtenden eines Managers, laut Organigramm (managerId-Kette abwärts). */
export async function getManagedUserIds(managerId: string, organizationId: string): Promise<string[]> {
  const all = await prisma.user.findMany({
    where: { organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
    select: { id: true, managerId: true },
  });
  const childrenOf = new Map<string, string[]>();
  for (const u of all) {
    if (!u.managerId) continue;
    const list = childrenOf.get(u.managerId) ?? [];
    list.push(u.id);
    childrenOf.set(u.managerId, list);
  }

  const result: string[] = [];
  const queue = [...(childrenOf.get(managerId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    result.push(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return result;
}

export type AbsenceBalanceView = {
  type: { id: string; name: string; icon: string; color: string; allowanceType: AbsenceAllowanceType; weeklyCapDays: number | null };
  totalDays: number | null;
  usedDays: number;
  remainingDays: number | null;
};

/**
 * "Konten" für `userId`/`year`: je aktiver Abwesenheitsart das Jahres-Kontingent
 * (LIMITED, aus AbsenceBalance oder AbsenceType.defaultAnnualDays) minus die
 * bereits genehmigten Tage dieses Jahres - UNLIMITED-Arten haben kein
 * Kontingent, nur einen Verbrauchszähler zur Information.
 */
export async function getAbsenceBalances(userId: string, year: number): Promise<AbsenceBalanceView[]> {
  const [types, balances, approvedRequests] = await Promise.all([
    prisma.absenceType.findMany({ where: { archivedAt: null }, orderBy: { order: "asc" } }),
    prisma.absenceBalance.findMany({ where: { userId, year } }),
    prisma.absenceRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
      },
    }),
  ]);

  const balanceByType = new Map(balances.map((b) => [b.absenceTypeId, b.totalDays]));
  const usedByType = new Map<string, number>();
  for (const request of approvedRequests) {
    usedByType.set(request.absenceTypeId, (usedByType.get(request.absenceTypeId) ?? 0) + request.days);
  }

  return types.map((type) => {
    const usedDays = usedByType.get(type.id) ?? 0;
    const totalDays =
      type.allowanceType === "LIMITED" ? (balanceByType.get(type.id) ?? type.defaultAnnualDays ?? 0) : null;
    return {
      type: { id: type.id, name: type.name, icon: type.icon, color: type.color, allowanceType: type.allowanceType, weeklyCapDays: type.weeklyCapDays },
      totalDays,
      usedDays,
      remainingDays: totalDays !== null ? totalDays - usedDays : null,
    };
  });
}
