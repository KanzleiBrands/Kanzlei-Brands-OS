"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { isAgencyDepartment } from "@/lib/agency-departments";
import { isSuperAdmin } from "@/lib/super-admin";

/**
 * Internes Portal verwalten (Abteilungs-Ressourcen/Kurse) ist eine echte
 * Admin-Fähigkeit - bewusst NICHT an die Rolle AGENCY_ADMIN gekoppelt, da die
 * auch an normale Fulfillment-Mitarbeitende für vollen CRM-Zugriff vergeben
 * wird (siehe src/lib/super-admin.ts, gleicher Vorfall wie beim Cashflow
 * Cockpit und Sales Cockpit/Marketing-Center).
 */
function requireSuperAdmin(email: string) {
  if (!isSuperAdmin(email)) throw new Error("Nur der Super-Admin kann das interne Portal verwalten.");
}

export async function addDepartmentResourceLink(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireSuperAdmin(session.user.email);

  const department = String(formData.get("department") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!isAgencyDepartment(department)) return "Ungültige Abteilung.";
  if (!label || !url) return "Bezeichnung und Link sind erforderlich.";

  const count = await prisma.departmentResourceLink.count({ where: { department } });
  await prisma.departmentResourceLink.create({
    data: { department, label, url, order: count },
  });

  revalidatePath("/dashboard/intern");
  revalidatePath("/dashboard/intern/verwaltung");
  return undefined;
}

export async function deleteDepartmentResourceLink(id: string) {
  const session = await requireSession();
  requireSuperAdmin(session.user.email);

  await prisma.departmentResourceLink.delete({ where: { id } });

  revalidatePath("/dashboard/intern");
  revalidatePath("/dashboard/intern/verwaltung");
}
