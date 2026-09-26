"use server";

import { revalidatePath } from "next/cache";
import type { AbsenceRequestStatus, EmployeeDocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { requireHrAdmin, canApproveAbsenceFor, getAbsenceApprovers, isAgencyMember } from "@/lib/hr-access";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { isAgencyDepartment } from "@/lib/agency-departments";
import { sendSystemEmail } from "@/lib/email/resend";
import { renderBrandedEmail } from "@/lib/email/template";
import { getSystemEmailContent, logSystemEmailSent, substitutePlaceholders } from "@/lib/email/system-email";
import { getBaseUrl } from "@/lib/base-url";

const ABSENCE_DATE_FMT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
function formatRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString("de-DE", ABSENCE_DATE_FMT)} - ${end.toLocaleDateString("de-DE", ABSENCE_DATE_FMT)}`;
}

const PERSONAL_PATH = "/dashboard/intern/personal";

function parseDate(value: FormDataEntryValue | null): Date | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Kalendertage Mo-Fr zwischen zwei Daten (inklusive), ohne Berücksichtigung von Feiertagen. */
function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Mitarbeiterprofil (Admin-Pflege)
// ---------------------------------------------------------------------------

export async function updateEmployeeProfile(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);

  const userId = String(formData.get("userId") ?? "");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== session.user.organizationId || !isAgencyMember(target.role)) {
    return "Ungültiger Mitarbeiter.";
  }

  const position = String(formData.get("position") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "");
  const managerIdRaw = String(formData.get("managerId") ?? "").trim();
  const managerId = managerIdRaw && managerIdRaw !== "__none__" ? managerIdRaw : null;
  const birthday = parseDate(formData.get("birthday"));
  const hireDate = parseDate(formData.get("hireDate"));
  const active = formData.get("active") === "true";

  if (managerId) {
    if (managerId === userId) return "Ein Mitarbeiter kann nicht sein eigener Manager sein.";
    const manager = await prisma.user.findUnique({ where: { id: managerId } });
    if (!manager || manager.organizationId !== session.user.organizationId || !isAgencyMember(manager.role)) {
      return "Ungültiger Manager.";
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      position,
      location,
      department: department && isAgencyDepartment(department) ? department : null,
      managerId,
      birthday,
      hireDate,
      employmentEndedAt: active ? null : (target.employmentEndedAt ?? new Date()),
    },
  });

  revalidatePath(`${PERSONAL_PATH}/verzeichnis`);
  revalidatePath(`${PERSONAL_PATH}/${userId}`);
  revalidatePath(`${PERSONAL_PATH}/organigramm`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Digitale Personalakte
// ---------------------------------------------------------------------------

export async function uploadEmployeeDocument(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);

  const userId = String(formData.get("userId") ?? "");
  const category = String(formData.get("category") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const documentDate = parseDate(formData.get("documentDate"));
  const file = formData.get("file");

  if (!["CONTRACT", "CERTIFICATE", "OTHER"].includes(category)) return "Ungültige Kategorie.";
  if (!title) return "Titel ist erforderlich.";
  if (!(file instanceof File) || file.size === 0) return "Bitte eine Datei auswählen.";
  if (file.size > MAX_UPLOAD_BYTES) return `Datei ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== session.user.organizationId) return "Ungültiger Mitarbeiter.";

  let fileUrl: string;
  try {
    fileUrl = await storeFile(file, "employee-documents");
  } catch {
    return "Datei konnte nicht hochgeladen werden.";
  }

  await prisma.employeeDocument.create({
    data: {
      userId,
      category: category as EmployeeDocumentCategory,
      title,
      description: description || null,
      documentDate,
      fileUrl,
      uploadedByUserId: session.user.id,
    },
  });

  revalidatePath(`${PERSONAL_PATH}/${userId}`);
  return undefined;
}

export async function deleteEmployeeDocument(documentId: string) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);

  const doc = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
  if (!doc) return;
  await prisma.employeeDocument.delete({ where: { id: documentId } });
  revalidatePath(`${PERSONAL_PATH}/${doc.userId}`);
}

// ---------------------------------------------------------------------------
// Abwesenheitsarten (Admin-Konfiguration)
// ---------------------------------------------------------------------------

export async function createAbsenceType(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);

  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "CalendarDays").trim();
  const color = String(formData.get("color") ?? "blue").trim();
  const allowanceType = String(formData.get("allowanceType") ?? "UNLIMITED");
  const defaultAnnualDays = formData.get("defaultAnnualDays") ? Number(formData.get("defaultAnnualDays")) : null;
  const weeklyCapDays = formData.get("weeklyCapDays") ? Number(formData.get("weeklyCapDays")) : null;
  const requiresApproval = formData.get("requiresApproval") === "true";

  if (!name) return "Name ist erforderlich.";
  if (allowanceType !== "LIMITED" && allowanceType !== "UNLIMITED") return "Ungültiger Kontingent-Typ.";

  const count = await prisma.absenceType.count();
  await prisma.absenceType.create({
    data: {
      name,
      icon,
      color,
      allowanceType,
      defaultAnnualDays: allowanceType === "LIMITED" ? defaultAnnualDays : null,
      weeklyCapDays,
      requiresApproval,
      order: count,
    },
  });

  revalidatePath(`${PERSONAL_PATH}/abwesenheit`);
  return undefined;
}

export async function archiveAbsenceType(typeId: string) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);
  await prisma.absenceType.update({ where: { id: typeId }, data: { archivedAt: new Date() } });
  revalidatePath(`${PERSONAL_PATH}/abwesenheit`);
}

// ---------------------------------------------------------------------------
// Konten (Jahres-Kontingente)
// ---------------------------------------------------------------------------

export async function setAbsenceBalance(formData: FormData) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);

  const userId = String(formData.get("userId") ?? "");
  const absenceTypeId = String(formData.get("absenceTypeId") ?? "");
  const year = Number(formData.get("year"));
  const totalDays = Number(formData.get("totalDays"));
  if (!userId || !absenceTypeId || !Number.isFinite(year) || !Number.isFinite(totalDays)) return;

  await prisma.absenceBalance.upsert({
    where: { userId_absenceTypeId_year: { userId, absenceTypeId, year } },
    create: { userId, absenceTypeId, year, totalDays },
    update: { totalDays },
  });

  revalidatePath(`${PERSONAL_PATH}/abwesenheit`);
  revalidatePath(`${PERSONAL_PATH}/${userId}`);
}

// ---------------------------------------------------------------------------
// Anträge (Antragsmanagement)
// ---------------------------------------------------------------------------

export async function createAbsenceRequest(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (!isAgencyMember(session.user.role)) return "Nur für Agentur-Mitarbeiter verfügbar.";

  const absenceTypeId = String(formData.get("absenceTypeId") ?? "");
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const note = String(formData.get("note") ?? "").trim();

  if (!startDate || !endDate) return "Bitte Start- und Enddatum angeben.";
  if (endDate < startDate) return "Enddatum darf nicht vor dem Startdatum liegen.";

  const [type, requester] = await Promise.all([
    prisma.absenceType.findUnique({ where: { id: absenceTypeId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { managerId: true } }),
  ]);
  if (!type || type.archivedAt) return "Ungültige Abwesenheitsart.";

  const days = businessDaysBetween(startDate, endDate);
  if (days === 0) return "Der gewählte Zeitraum enthält keine Werktage.";

  const requiresApproval = type.requiresApproval;
  await prisma.absenceRequest.create({
    data: {
      userId: session.user.id,
      absenceTypeId,
      startDate,
      endDate,
      days,
      note: note || null,
      status: requiresApproval ? "PENDING" : "APPROVED",
    },
  });

  if (requiresApproval) {
    const approvers = await getAbsenceApprovers({
      id: session.user.id,
      managerId: requester?.managerId ?? null,
      organizationId: session.user.organizationId,
    });

    if (approvers.length > 0) {
      const baseUrl = await getBaseUrl();
      const content = await getSystemEmailContent("ABSENCE_REQUEST_SUBMITTED");
      const ctaUrl = `${baseUrl}${PERSONAL_PATH}/abwesenheit?tab=antraege`;
      const sharedVars = {
        mitarbeiter: session.user.name,
        art: type.name,
        zeitraum: formatRange(startDate, endDate),
        tage: String(days),
      };

      for (const approver of approvers) {
        const vars = { ...sharedVars, name: approver.name };
        const subject = substitutePlaceholders(content.subject, vars);
        const { html, text } = renderBrandedEmail({
          baseUrl,
          preheader: subject,
          heading: substitutePlaceholders(content.heading, vars),
          paragraphs: [substitutePlaceholders(content.body, vars)],
          ctaLabel: content.ctaLabel,
          ctaUrl,
          footerNote: content.footerNote ? substitutePlaceholders(content.footerNote, vars) : undefined,
        });
        const result = await sendSystemEmail({ to: approver.email, subject, text, html });
        if (result.ok) {
          await logSystemEmailSent({
            type: "ABSENCE_REQUEST_SUBMITTED",
            to: approver.email,
            subject,
            organizationId: session.user.organizationId,
            userId: approver.id,
          });
        }
      }
    }
  }

  revalidatePath(`${PERSONAL_PATH}/abwesenheit`);
  revalidatePath(PERSONAL_PATH);
  return undefined;
}

export async function cancelAbsenceRequest(requestId: string) {
  const session = await requireSession();
  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId } });
  if (!request) return;

  const canManage = session.user.id === request.userId || (await canApproveAbsenceFor(session, request.userId));
  if (!canManage) return;
  if (request.status === "DECLINED" || request.status === "CANCELLED") return;

  await prisma.absenceRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  revalidatePath(`${PERSONAL_PATH}/abwesenheit`);
  revalidatePath(PERSONAL_PATH);
}

export async function decideAbsenceRequest(requestId: string, decision: "APPROVED" | "DECLINED") {
  const session = await requireSession();
  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId }, include: { absenceType: true, user: true } });
  if (!request) return "Antrag nicht gefunden.";
  if (request.status !== "PENDING") return "Antrag wurde bereits entschieden.";

  const allowed = await canApproveAbsenceFor(session, request.userId);
  if (!allowed) return "Keine Berechtigung, diesen Antrag zu entscheiden.";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: decision as AbsenceRequestStatus,
      decidedByUserId: session.user.id,
      decidedAt: new Date(),
    },
  });

  const baseUrl = await getBaseUrl();
  const content = await getSystemEmailContent("ABSENCE_REQUEST_DECIDED");
  const vars = {
    name: request.user.name,
    art: request.absenceType.name,
    zeitraum: formatRange(request.startDate, request.endDate),
    entscheidung: decision === "APPROVED" ? "genehmigt" : "abgelehnt",
  };
  const subject = substitutePlaceholders(content.subject, vars);
  const { html, text } = renderBrandedEmail({
    baseUrl,
    preheader: subject,
    heading: substitutePlaceholders(content.heading, vars),
    paragraphs: [substitutePlaceholders(content.body, vars)],
    ctaLabel: content.ctaLabel,
    ctaUrl: `${baseUrl}${PERSONAL_PATH}/abwesenheit`,
    footerNote: content.footerNote ? substitutePlaceholders(content.footerNote, vars) : undefined,
  });
  const result = await sendSystemEmail({ to: request.user.email, subject, text, html });
  if (result.ok) {
    await logSystemEmailSent({
      type: "ABSENCE_REQUEST_DECIDED",
      to: request.user.email,
      subject,
      organizationId: session.user.organizationId,
      userId: request.user.id,
    });
  }

  revalidatePath(`${PERSONAL_PATH}/abwesenheit`);
  revalidatePath(PERSONAL_PATH);
  return undefined;
}

// ---------------------------------------------------------------------------
// Unternehmensdaten
// ---------------------------------------------------------------------------

export async function updateCompanyProfile(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireHrAdmin(session.user.role);

  const name = String(formData.get("name") ?? "").trim();
  const companyWebsite = String(formData.get("companyWebsite") ?? "").trim();
  const businessNumber = String(formData.get("businessNumber") ?? "").trim();
  const vatId = String(formData.get("vatId") ?? "").trim();
  const foundedYearRaw = String(formData.get("foundedYear") ?? "").trim();
  const mission = String(formData.get("mission") ?? "").trim();

  if (!name) return "Firmenname ist erforderlich.";
  const foundedYear = foundedYearRaw ? Number(foundedYearRaw) : null;
  if (foundedYearRaw && !Number.isFinite(foundedYear)) return "Ungültiges Gründungsjahr.";

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      name,
      companyWebsite: companyWebsite || null,
      businessNumber: businessNumber || null,
      vatId: vatId || null,
      foundedYear,
      mission: mission || null,
    },
  });

  revalidatePath(`${PERSONAL_PATH}/unternehmen`);
  return undefined;
}
