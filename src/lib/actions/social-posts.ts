"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Nur Agentur-Admins können Beiträge bearbeiten.");
}

export async function uploadSocialPostImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { error: "Nur Agentur-Admins können Bilder hochladen." };
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

export async function createSocialPost(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const organizationId = String(formData.get("organizationId") ?? "");
  const platform = String(formData.get("platform") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();
  const mediaType = String(formData.get("mediaType") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  const pipelineId = String(formData.get("pipelineId") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "").trim();
  const scheduledAt = parseScheduledAt(formData.get("scheduledAt"));

  if (!organizationId) return "Kunde ist erforderlich.";
  if (platform !== "FACEBOOK" && platform !== "INSTAGRAM" && platform !== "LINKEDIN") return "Plattform ist erforderlich.";
  if (!caption) return "Text ist erforderlich.";

  await prisma.socialPost.create({
    data: {
      organizationId,
      platform,
      caption,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType === "IMAGE" || mediaType === "VIDEO" ? mediaType : null,
      channelId: channelId || null,
      pipelineId: pipelineId || null,
      responsibleUserId: responsibleUserId || null,
      scheduledAt,
    },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
}

export async function updateSocialPost(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const postId = String(formData.get("postId") ?? "");
  const platform = String(formData.get("platform") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();
  const mediaType = String(formData.get("mediaType") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  const pipelineId = String(formData.get("pipelineId") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "").trim();
  const scheduledAt = parseScheduledAt(formData.get("scheduledAt"));

  if (platform !== "FACEBOOK" && platform !== "INSTAGRAM" && platform !== "LINKEDIN") return "Plattform ist erforderlich.";
  if (!caption) return "Text ist erforderlich.";

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return "Beitrag nicht gefunden.";

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      platform,
      caption,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType === "IMAGE" || mediaType === "VIDEO" ? mediaType : null,
      channelId: channelId || null,
      pipelineId: pipelineId || null,
      responsibleUserId: responsibleUserId || null,
      scheduledAt,
    },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
}

export async function deleteSocialPost(formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;

  await prisma.socialPost.delete({ where: { id: postId } });
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
}

const AGENCY_SETTABLE_STATUSES = ["IDEA", "IN_PRODUCTION", "CLIENT_REVIEW", "SCHEDULED"] as const;
type AgencySettableStatus = (typeof AGENCY_SETTABLE_STATUSES)[number];

function isAgencySettableStatus(value: string): value is AgencySettableStatus {
  return (AGENCY_SETTABLE_STATUSES as readonly string[]).includes(value);
}

/** Quick status change from the board (drag between columns) - agency only. */
export async function moveSocialPostStatus(formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const postId = String(formData.get("postId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isAgencySettableStatus(status)) throw new Error("Unbekannter Status.");

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;
  if (status === "SCHEDULED" && !post.scheduledAt) {
    throw new Error("Bitte zuerst ein Veröffentlichungsdatum festlegen.");
  }

  await prisma.socialPost.update({ where: { id: postId }, data: { status } });
  revalidatePath("/dashboard/social");
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
