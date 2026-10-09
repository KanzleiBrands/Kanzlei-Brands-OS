"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, assertCanManageSocialContentFor } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { csvToObjects } from "@/lib/csv";
import { normalizeFieldKey } from "@/lib/webhook-ingest";
import { publishSocialPostById } from "@/lib/social/publish";

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

function isValidPlatform(value: string): value is "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" {
  return value === "FACEBOOK" || value === "INSTAGRAM" || value === "LINKEDIN";
}

function isValidFormat(value: string): value is "REEL" | "IMAGE_POST" | "CAROUSEL" | "THOUGHT_LEADERSHIP" {
  return value === "REEL" || value === "IMAGE_POST" || value === "CAROUSEL" || value === "THOUGHT_LEADERSHIP";
}

/** {platform, channelId}[] fürs gleichzeitige Anlegen eines Beitrags auf mehreren Plattformen (Beitrag-anlegen-Dialog). */
function parseSelections(raw: FormDataEntryValue | null): { platform: string; channelId: string }[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is { platform: unknown; channelId: unknown } => typeof v === "object" && v !== null)
      .map((v) => ({
        platform: typeof v.platform === "string" ? v.platform : "",
        channelId: typeof v.channelId === "string" ? v.channelId : "",
      }))
      .filter((v) => v.platform);
  } catch {
    return [];
  }
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

  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();
  const mediaType = String(formData.get("mediaType") ?? "").trim();
  const mediaUrls = parseMediaUrls(formData.get("mediaUrls"));
  const formatRaw = String(formData.get("format") ?? "").trim();
  const format = isValidFormat(formatRaw) ? formatRaw : null;
  const script = String(formData.get("script") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "").trim();
  const publishNow = formData.get("publishNow") === "1";
  const scheduledAt = publishNow ? new Date() : parseScheduledAt(formData.get("scheduledAt"));

  // "selections" trägt eine oder mehrere {platform, channelId} - ein Beitrag
  // wird pro ausgewählter Plattform angelegt (gleicher Text/Medien/Termin),
  // damit ein Beitrag mit einem Klick gleichzeitig auf Facebook, Instagram
  // und LinkedIn geplant werden kann. Fällt auf die alten Einzelfelder
  // zurück, falls "selections" fehlt (Abwärtskompatibilität).
  const parsedSelections = parseSelections(formData.get("selections"));
  const selections =
    parsedSelections.length > 0
      ? parsedSelections
      : [{ platform: String(formData.get("platform") ?? ""), channelId: String(formData.get("channelId") ?? "").trim() }];

  if (selections.length === 0) return "Mindestens eine Plattform ist erforderlich.";
  const validSelections: { platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; channelId: string }[] = [];
  for (const sel of selections) {
    if (!isValidPlatform(sel.platform)) return "Plattform ist erforderlich.";
    validSelections.push({ platform: sel.platform, channelId: sel.channelId });
  }
  if (!caption) return "Text ist erforderlich.";
  if (mediaType === "CAROUSEL" && mediaUrls.length < 2) return "Karussell benötigt mindestens 2 Bilder.";
  if (publishNow && validSelections.some((sel) => !sel.channelId)) {
    return "Für sofortiges Veröffentlichen muss für jede Plattform ein Kanal ausgewählt sein.";
  }

  // Einzeln statt createMany, damit die IDs für ein sofortiges Veröffentlichen
  // (s.u.) zur Verfügung stehen - createMany gibt keine Datensätze zurück.
  const created = await Promise.all(
    validSelections.map((sel) =>
      prisma.socialPost.create({
        data: {
          organizationId,
          platform: sel.platform,
          caption,
          mediaUrl: mediaType === "CAROUSEL" ? null : mediaUrl || null,
          mediaUrls: mediaType === "CAROUSEL" ? mediaUrls : [],
          mediaType: isValidMediaType(mediaType) ? mediaType : null,
          format,
          script: script || null,
          channelId: sel.channelId || null,
          responsibleUserId: responsibleUserId || null,
          scheduledAt,
        },
      }),
    ),
  );

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidateInternalMarketing();

  if (publishNow) {
    const results = await Promise.all(created.map((post) => publishSocialPostById(post.id)));
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      return `Beitrag gespeichert, aber Veröffentlichung fehlgeschlagen: ${failures.map((f) => f.error).join("; ")}`;
    }
  }
}

export async function updateSocialPost(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const postId = String(formData.get("postId") ?? "");
  const platform = String(formData.get("platform") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaUrl = String(formData.get("mediaUrl") ?? "").trim();
  const mediaType = String(formData.get("mediaType") ?? "").trim();
  const mediaUrls = parseMediaUrls(formData.get("mediaUrls"));
  const formatRaw = String(formData.get("format") ?? "").trim();
  const format = isValidFormat(formatRaw) ? formatRaw : null;
  const script = String(formData.get("script") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "").trim();
  const publishNow = formData.get("publishNow") === "1";
  const scheduledAt = publishNow ? new Date() : parseScheduledAt(formData.get("scheduledAt"));

  // Zusätzlich beim Bearbeiten ausgewählte, neue Plattformen (siehe
  // social-post-form-dialog.tsx) - legt dafür je einen neuen Beitrag an statt
  // den bestehenden umzuwandeln, analog zu "selections" bei createSocialPost.
  const extraSelections = parseSelections(formData.get("extraSelections"));

  if (platform !== "FACEBOOK" && platform !== "INSTAGRAM" && platform !== "LINKEDIN") return "Plattform ist erforderlich.";
  if (!caption) return "Text ist erforderlich.";
  if (mediaType === "CAROUSEL" && mediaUrls.length < 2) return "Karussell benötigt mindestens 2 Bilder.";
  if (publishNow && !channelId) return "Für sofortiges Veröffentlichen muss ein Kanal ausgewählt sein.";
  const validExtraSelections: { platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN"; channelId: string }[] = [];
  for (const sel of extraSelections) {
    if (!isValidPlatform(sel.platform)) continue;
    validExtraSelections.push({ platform: sel.platform, channelId: sel.channelId });
  }
  if (publishNow && validExtraSelections.some((sel) => !sel.channelId)) {
    return "Für sofortiges Veröffentlichen muss für jede zusätzliche Plattform ein Kanal ausgewählt sein.";
  }

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
      format,
      script: script || null,
      channelId: channelId || null,
      responsibleUserId: responsibleUserId || null,
      scheduledAt,
    },
  });

  const createdExtra = await Promise.all(
    validExtraSelections.map((sel) =>
      prisma.socialPost.create({
        data: {
          organizationId: post.organizationId,
          platform: sel.platform,
          caption,
          mediaUrl: mediaType === "CAROUSEL" ? null : mediaUrl || null,
          mediaUrls: mediaType === "CAROUSEL" ? mediaUrls : [],
          mediaType: isValidMediaType(mediaType) ? mediaType : null,
          format,
          script: script || null,
          channelId: sel.channelId || null,
          responsibleUserId: responsibleUserId || null,
          scheduledAt,
        },
      }),
    ),
  );

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
  revalidateInternalMarketing();

  if (publishNow) {
    const results = await Promise.all([postId, ...createdExtra.map((p) => p.id)].map((id) => publishSocialPostById(id)));
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      return `Beitrag gespeichert, aber Veröffentlichung fehlgeschlagen: ${failures.map((f) => f.error).join("; ")}`;
    }
  }
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

/**
 * Content-Recycling: dupliziert einen bereits veröffentlichten, gut
 * performenden Beitrag als neue Idee (Status IDEA, ohne Termin) - Grundlage
 * für die "Wiederverwendungs-Vorschläge" in der Analytics-Ansicht
 * (social-analytics.tsx). Kopiert Text/Medien/Format 1:1; die Agentur
 * passt den Text dann für die erneute Verwendung an.
 */
export async function duplicateSocialPostAsIdea(formData: FormData): Promise<void> {
  const session = await requireSession();
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;
  await assertCanManageSocialContentFor(session, post.organizationId);

  await prisma.socialPost.create({
    data: {
      organizationId: post.organizationId,
      platform: post.platform,
      status: "IDEA",
      caption: post.caption,
      mediaUrl: post.mediaUrl,
      mediaUrls: post.mediaUrls,
      mediaType: post.mediaType,
      format: post.format,
      contentFormatId: post.contentFormatId,
      channelId: post.channelId,
    },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${post.organizationId}`);
  revalidateInternalMarketing();
}

const AGENCY_SETTABLE_STATUSES = ["IDEA", "IN_PRODUCTION", "CLIENT_REVIEW", "SCHEDULED"] as const;
type AgencySettableStatus = (typeof AGENCY_SETTABLE_STATUSES)[number];

function isAgencySettableStatus(value: string): value is AgencySettableStatus {
  return (AGENCY_SETTABLE_STATUSES as readonly string[]).includes(value);
}

/**
 * Bulk-Terminplanung: verteilt mehrere produktionsbereite Beiträge auf einen
 * Rutsch statt jeden einzeln manuell zu planen - setzt scheduledAt und Status
 * SCHEDULED für jeden übergebenen Beitrag. Die eigentliche Verteilung
 * (Startdatum + Rhythmus -> ein Termin pro Beitrag) passiert bewusst im
 * Browser (bulk-schedule-dialog.tsx), aus demselben Grund wie
 * localDatetimeToIso in social-post-form-dialog.tsx: nur dort ist die
 * Zeitzone des Nutzers bekannt, der auf Vercel in UTC laufende Server würde
 * sonst falsch rechnen.
 */
export async function bulkSchedulePosts(formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Beiträge planen.";
  }

  const postIds = formData.getAll("postIds").map(String).filter(Boolean);
  const scheduledAtsRaw = formData.getAll("scheduledAts").map(String);
  if (postIds.length === 0 || postIds.length !== scheduledAtsRaw.length) {
    return "Bitte mindestens einen Beitrag mit gültigem Termin auswählen.";
  }

  const posts = await prisma.socialPost.findMany({ where: { id: { in: postIds }, organizationId } });
  if (posts.length !== postIds.length) return "Mindestens ein Beitrag gehört nicht zu diesem Kunden.";

  for (let i = 0; i < postIds.length; i++) {
    const scheduledAt = new Date(scheduledAtsRaw[i]);
    if (Number.isNaN(scheduledAt.getTime())) continue;
    await prisma.socialPost.update({ where: { id: postIds[i] }, data: { status: "SCHEDULED", scheduledAt } });
  }

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidateInternalMarketing();
  return undefined;
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

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status, ...(status === "CLIENT_REVIEW" ? { reviewReminderSentAt: null } : {}) },
  });
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
 * Kanal/Channel (optional - matched by display name).
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
        channelId: channel?.id ?? null,
        scheduledAt,
      },
    });
    imported++;
  }

  if (imported === 0) {
    return "Keine gültigen Zeilen gefunden. Spalten: Plattform, Text (Bild-URL, Veröffentlichung, Kanal optional).";
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
