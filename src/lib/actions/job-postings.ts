"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { JOB_PORTALS } from "@/lib/job-portals";
import { EMPLOYMENT_TYPES } from "@/lib/job-schema";

function parseStringArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export async function uploadJobPostingImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { error: "Nur Agentur-Admins können Bilder hochladen." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei ausgewählt." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `Bild ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const url = await storeFile(file, "job-postings");
  return { url };
}

export async function updateJobPosting(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können die Stellenportal-Inhalte bearbeiten.";

  const pipelineId = String(formData.get("pipelineId") ?? "");
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return "Kampagne nicht gefunden.";
  if (pipeline.kind !== "APPLICANTS") return "Stellenportal-Inhalte sind nur für Recruiting-Kampagnen möglich.";
  try {
    assertOrganizationAccess(session, pipeline.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const heroImageUrl = String(formData.get("heroImageUrl") ?? "").trim() || null;
  const galleryUrls = parseStringArray(formData.get("galleryUrls"));
  const aboutUs = String(formData.get("aboutUs") ?? "").trim() || null;
  const tasks = String(formData.get("tasks") ?? "").trim() || null;
  const profile = String(formData.get("profile") ?? "").trim() || null;
  const benefitsList = parseStringArray(formData.get("benefitsList"));
  const contactName = String(formData.get("contactName") ?? "").trim() || null;
  const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;
  const applicationUrl = String(formData.get("applicationUrl") ?? "").trim() || null;
  const validPortalKeys = new Set(JOB_PORTALS.map((p) => p.key));
  const targetPortals = parseStringArray(formData.get("targetPortals")).filter((key) => validPortalKeys.has(key));

  const employerName = String(formData.get("employerName") ?? "").trim() || null;
  const employerLogoUrl = String(formData.get("employerLogoUrl") ?? "").trim() || null;
  const employerWebsite = String(formData.get("employerWebsite") ?? "").trim() || null;
  const street = String(formData.get("street") ?? "").trim() || null;
  const postalCode = String(formData.get("postalCode") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || "DE";
  const validEmploymentTypes = new Set(EMPLOYMENT_TYPES.map((t) => t.value));
  const employmentTypeRaw = String(formData.get("employmentType") ?? "");
  const employmentType = validEmploymentTypes.has(employmentTypeRaw) ? employmentTypeRaw : "FULL_TIME";
  const validThroughRaw = String(formData.get("validThrough") ?? "").trim();
  const validThrough = validThroughRaw ? new Date(validThroughRaw) : null;
  const isPublished = formData.get("isPublished") === "true";

  if (isPublished && !city) return "Für die Veröffentlichung wird mindestens die Stadt (Arbeitsort) benötigt.";

  const existing = await prisma.jobPosting.findUnique({ where: { pipelineId }, select: { publishedAt: true } });
  const publishedAt = isPublished ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null);

  await prisma.jobPosting.upsert({
    where: { pipelineId },
    create: {
      pipelineId,
      heroImageUrl,
      galleryUrls,
      aboutUs,
      tasks,
      profile,
      benefitsList,
      contactName,
      contactEmail,
      applicationUrl,
      targetPortals,
      employerName,
      employerLogoUrl,
      employerWebsite,
      street,
      postalCode,
      city,
      country,
      employmentType,
      validThrough,
      isPublished,
      publishedAt,
    },
    update: {
      heroImageUrl,
      galleryUrls,
      aboutUs,
      tasks,
      profile,
      benefitsList,
      contactName,
      contactEmail,
      applicationUrl,
      targetPortals,
      employerName,
      employerLogoUrl,
      employerWebsite,
      street,
      postalCode,
      city,
      country,
      employmentType,
      validThrough,
      isPublished,
      publishedAt,
    },
  });

  await logAudit({
    action: "job_posting.updated",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: pipeline.organizationId,
    userId: session.user.id,
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  revalidatePath(`/jobs/${pipelineId}`);
  return undefined;
}
