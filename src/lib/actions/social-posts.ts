"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, assertCanManageSocialContentFor } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { csvToObjects } from "@/lib/csv";
import { normalizeFieldKey } from "@/lib/webhook-ingest";

/** Extra Revalidierung fürs interne Marketing-Center - ein No-Op, wenn der Pfad gar nicht gecacht war. */
function revalidateInternalMarketing() {
  revalidatePath("/dashboard/intern/marketing/social");
}

export async function uploadSocialPostImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const session = await requireSession();
  try {
    await assertCanManageSocialContentFor(session, session.user.organizationId);
  } catch {
    return { error: "Nur Agentur-Admins oder Marketing-Mitarbeiter können Bilder hochladen." };
  }
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei ausgewählt." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `Bild ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const url = await storeFile(file, "social-posts");
  return { url };
}

function parseScheduledAt(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMediaUrls(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
  } catch {
    return [];
  }
}

function isValidMediaType(value: string): value is "IMAGE" | "VIDEO" | "CAROUSEL" {
  return value === "IMAGE" || value === "VIDEO" || value === "CAROUSEL";
}

export async function createSocialPost(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Beiträge bearbeiten.";
  }

  const platform = String(formData.get("platform") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();
  const mediaType = String(formData.get("mediaType") ?? "").trim();
  const mediaUrls = parseMediaUrls(formData.get("mediaUrls"));
  const utmCampaign = String(formData.get("utmCampaign") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  const pipelineId = String(formData.get("pipelineId") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "").trim();
  const scheduledAt = parseScheduledAt(formData.get("scheduledAt"));

  if (platform !== "FACEBOOK" && platform !== "INSTAGRAM" && platform !== "LINKEDIN") return "Plattform ist erforderlich.";
  if (!caption) return "Text ist erforderlich.";
  if (mediaType === "CAROUSEL" && mediaUrls.length < 2) return "Karussell benötigt mindestens 2 Bilder.";

  await prisma.socialPost.create({
    data: {
      organizationId,
      platform,
      caption,
      mediaUrl: mediaType === "CAROUSEL" ? null : mediaUrl || null,
      mediaUrls: mediaType === "CAROUSEL" ? mediaUrls : [],
      mediaType: isValidMediaType(mediaType) ? mediaType : null,
      utmCampaign: utmCampaign || null,
      channelId: channelId || null,
      pipelineId: pipelineId || null,
      responsibleUserId: responsibleUserId || null,
      scheduledAt,
    },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidateInternalMarketing();
}

export async function updateSocialPost(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const postId = String(formData.get("postId") ?? "");
  const platform = String(formData.get("platform") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();
  const mediaType = String(formData.get("mediaType") ?? "").trim();
  const mediaUrls = parseMediaUrls(formData.get("mediaUrls"));
  const utmCampaign = String(formData.get("utmCampaign") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  const pipelineId = String(formData.get("pipelineId") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "").trim();
  const scheduledAt = parseScheduledAt(formData.get("scheduledAt"));

  if (platform !== "FACEBOOK" && platform !== "INSTAGRAM" && platform !== "LINKEDIN") return "Plattform ist erforderlich.";
  if (!caption) return "Text ist erforderlich.";
  if (mediaType === "CAROUSEL" && mediaUrls.length < 2) return "Karussell benötigt mindestens 2 Bilder.";

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return "Beitrag nicht gefunden.";
  try {
    await assertCanManageSocialContentFor(session, post.organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Beiträge bearbeiten.";
  }

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      platform,
      caption,
      mediaUrl: mediaType === "CAROUSEL" ? null : mediaUrl || null,
      mediaUrls: mediaType === "CAROUSEL" ? mediaUrls : [],
      mediaType: isValidMediaType(mediaType) ? mediaType : null,
      utmCampaign: utmCampaign || null,
      channelId: channelId || null,
      pipelineId: pipelineId || null,
      responsibleUserId: responsibleUserId || null,
      scheduledAt,
    },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
  revalidateInternalMarketing();
}

export async function deleteSocialPost(formData: FormData) {
  const session = await requireSession();

  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;
  await assertCanManageSocialContentFor(session, post.organizationId);

  await prisma.socialPost.delete({ where: { id: postId } });
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
  revalidateInternalMarketing();
}

const AGENCY_SETTABLE_STATUSES = ["IDEA", "IN_PRODUCTION", "CLIENT_REVIEW", "SCHEDULED"] as const;
type AgencySettableStatus = (typeof AGENCY_SETTABLE_STATUSES)[number];

function isAgencySettableStatus(value: string): value is AgencySettableStatus {
  return (AGENCY_SETTABLE_STATUSES as readonly string[]).includes(value);
}

/** Quick status change from the board (drag between columns) - agency only. */
export async function moveSocialPostStatus(formData: FormData) {
  const session = await requireSession();

  const postId = String(formData.get("postId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isAgencySettableStatus(status)) throw new Error("Unbekannter Status.");

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;
  await assertCanManageSocialContentFor(session, post.organizationId);
  if (status === "SCHEDULED" && !post.scheduledAt) {
    throw new Error("Bitte zuerst ein Veröffentlichungsdatum festlegen.");
  }

  await prisma.socialPost.update({ where: { id: postId }, data: { status } });
  revalidatePath("/dashboard/social");
  revalidateInternalMarketing();
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
}

/** Client approves a post awaiting review - moves straight to Geplant since the agency already set a publish date before requesting approval. */
export async function approveSocialPost(formData: FormData) {
  const session = await requireSession();
  const postId = String(formData.get("postId") ?? "");

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;
  assertOrganizationAccess(session, post.organizationId);
  if (post.status !== "CLIENT_REVIEW") throw new Error("Dieser Beitrag wartet nicht auf Freigabe.");

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: post.scheduledAt ? "SCHEDULED" : "IN_PRODUCTION", clientFeedback: null },
  });

  await logAudit({
    action: "social_post.approved",
    entityType: "SocialPost",
    entityId: postId,
    organizationId: post.organizationId,
    userId: session.user.id,
    metadata: { caption: post.caption.slice(0, 140) },
  });

  revalidatePath("/dashboard/hub");
  revalidatePath("/dashboard/social");
}

export async function requestSocialPostChanges(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const postId = String(formData.get("postId") ?? "");
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!feedback) return "Bitte beschreibe die gewünschte Änderung.";

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return "Beitrag nicht gefunden.";
  assertOrganizationAccess(session, post.organizationId);
  if (post.status !== "CLIENT_REVIEW") return "Dieser Beitrag wartet nicht auf Freigabe.";

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: "CHANGES_REQUESTED", clientFeedback: feedback },
  });

  await logAudit({
    action: "social_post.changes_requested",
    entityType: "SocialPost",
    entityId: postId,
    organizationId: post.organizationId,
    userId: session.user.id,
    metadata: { feedback },
  });

  revalidatePath("/dashboard/hub");
  revalidatePath("/dashboard/social");
  return undefined;
}

function normalizePlatformValue(value: string): "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | null {
  const v = value.trim().toUpperCase();
  if (v === "FACEBOOK" || v === "FB") return "FACEBOOK";
  if (v === "INSTAGRAM" || v === "IG") return "INSTAGRAM";
  if (v === "LINKEDIN") return "LINKEDIN";
  return null;
}

function parseCsvScheduledAt(raw: string): Date | null {
  if (!raw.trim()) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Bulk-schedules many posts from one CSV upload ("Massenimport"/"Bulk-
 * Zeitplan" in SocialPilot) - mirrors importContactsCsv's exact shape
 * (src/lib/actions/contacts.ts): single-shot, no preview/mapping step,
 * sequential creates, capped row count, audit-logged.
 * Columns (German or English header names, case-insensitive):
 * Plattform/Platform (required), Text/Caption (required), Bild-URL/MediaUrl
 * (optional, single image), Veröffentlichung/ScheduledAt (optional),
 * Kanal/Channel (optional - matched by display name), UTM-Kampagne (optional).
 * Imported posts always land as IDEA regardless of a given schedule date,
 * since a CSV row can't assign a connected channel by itself - the agency
 * reviews and schedules each one from the board after checking it over.
 */
export async function importSocialPostsCsv(_prevState: string | undefined, formData: FormData): Promise<string> {
  const session = await requireSession();

  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Beiträge importieren.";
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Keine Datei ausgewählt.";

  const text = await file.text();
  const rows = csvToObjects(text);
  if (rows.length === 0) return "CSV ist leer oder konnte nicht gelesen werden.";
  if (rows.length > 500) return "Maximal 500 Zeilen pro Import.";

  const channels = await prisma.socialChannel.findMany({ where: { organizationId } });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeFieldKey(key)] = value;
    }

    const platform = normalizePlatformValue(normalized.platform ?? normalized.plattform ?? "");
    const caption = (normalized.caption ?? normalized.text ?? normalized.beitragstext ?? "").trim();
    if (!platform || !caption) {
      skipped++;
      continue;
    }

    const mediaUrl = (normalized.mediaurl ?? normalized.bildurl ?? normalized.bild_url ?? "").trim();
    const scheduledAt = parseCsvScheduledAt(
      normalized.scheduledat ?? normalized.veroeffentlichung ?? normalized.geplante_veroeffentlichung ?? normalized.datum ?? "",
    );
    const utmCampaign = (normalized.utmcampaign ?? normalized.utm_campaign ?? normalized.utmkampagne ?? "").trim();
    const channelName = (normalized.channel ?? normalized.kanal ?? "").trim();
    const channel = channelName
      ? channels.find((c) => c.platform === platform && c.displayName.toLowerCase() === channelName.toLowerCase())
      : undefined;

    await prisma.socialPost.create({
      data: {
        organizationId,
        platform,
        caption,
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? "IMAGE" : null,
        utmCampaign: utmCampaign || null,
        channelId: channel?.id ?? null,
        scheduledAt,
      },
    });
    imported++;
  }

  if (imported === 0) {
    return "Keine gültigen Zeilen gefunden. Spalten: Plattform, Text (Bild-URL, Veröffentlichung, Kanal, UTM-Kampagne optional).";
  }

  await logAudit({
    action: "social_post.csv_imported",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { imported, skipped, rows: rows.length },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidateInternalMarketing();
  return `${imported} Beitrag/Beiträge importiert${skipped > 0 ? `, ${skipped} Zeile(n) übersprungen (fehlende Plattform/Text)` : ""}.`;
}
