"use server";

import { revalidatePath } from "next/cache";
import type { AgencyDepartment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { isAgencyDepartment } from "@/lib/agency-departments";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Nur Agentur-Admins können das interne Portal verwalten.");
}

export async function updateDepartmentContact(department: string, contactUserId: string | null) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);
  if (!isAgencyDepartment(department)) return "Ungültige Abteilung.";

  if (contactUserId) {
    const contact = await prisma.user.findUnique({ where: { id: contactUserId } });
    if (!contact || contact.organizationId !== session.user.organizationId || contact.role !== "AGENCY_ADMIN") {
      return "Ungültiger Ansprechpartner.";
    }
  }

  await prisma.departmentContact.upsert({
    where: { department },
    create: { department: department as AgencyDepartment, contactUserId },
    update: { contactUserId },
  });

  revalidatePath("/dashboard/intern");
  return undefined;
}

export async function addDepartmentResourceLink(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

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
  requireAgencyAdmin(session.user.role);

  await prisma.departmentResourceLink.delete({ where: { id } });

  revalidatePath("/dashboard/intern");
  revalidatePath("/dashboard/intern/verwaltung");
}
