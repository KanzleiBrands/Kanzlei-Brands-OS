"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { parseLessonBlocks, firstVideoBlockUrl, type LessonBlock } from "@/lib/lesson-blocks";
import { isAgencyDepartment } from "@/lib/agency-departments";

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

async function uploadImageField(formData: FormData, field: string): Promise<string | null | undefined> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Bild ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  return storeFile(file, "course-images");
}

export async function createCourse(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Kurse anlegen.";

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "TRAINING");
  const audience = String(formData.get("audience") ?? "CLIENT");
  if (!title) return "Titel ist erforderlich.";
  if (category !== "ONBOARDING" && category !== "TRAINING") return "Ungültige Kategorie.";
  if (audience !== "CLIENT" && audience !== "INTERNAL") return "Ungültige Zielgruppe.";

  let thumbnailUrl: string | null = null;
  try {
    thumbnailUrl = (await uploadImageField(formData, "thumbnail")) ?? null;
  } catch (error) {
    return error instanceof Error ? error.message : "Vorschaubild konnte nicht hochgeladen werden.";
  }

  await prisma.course.create({
    data: { title, description: description || null, category, audience, thumbnailUrl },
  });

  revalidatePath("/dashboard/courses");
  return undefined;
}

export async function updateCourse(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Kurse bearbeiten.";

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "TRAINING");
  if (!title) return "Titel ist erforderlich.";
  if (category !== "ONBOARDING" && category !== "TRAINING") return "Ungültige Kategorie.";

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return "Kurs nicht gefunden.";

  // Zielgruppe ist nach dem Anlegen bewusst nicht mehr änderbar - ein
  // Wechsel würde bestehende CourseAssignment/CourseDepartmentAssignment
  // verwaist zurücklassen, ohne dass hier aufgeräumt wird.
  const audience = course.audience;

  let thumbnailUrl: string | null | undefined;
  try {
    thumbnailUrl = await uploadImageField(formData, "thumbnail");
  } catch (error) {
    return error instanceof Error ? error.message : "Vorschaubild konnte nicht hochgeladen werden.";
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      title,
      description: description || null,
      category,
      audience,
      ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
    },
  });

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}`);
  return undefined;
}

/** Weist einen internen (audience=INTERNAL) Kurs einer Abteilung zu/ab - Pendant zu setCourseAssignment für Kunden. */
export async function setCourseDepartmentAssignment(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const courseId = String(formData.get("courseId") ?? "");
  const department = String(formData.get("department") ?? "");
  const assign = formData.get("assign") === "true";
  if (!isAgencyDepartment(department)) return;

  if (assign) {
    await prisma.courseDepartmentAssignment.upsert({
      where: { courseId_department: { courseId, department } },
      update: {},
      create: { courseId, department },
    });
  } else {
    await prisma.courseDepartmentAssignment.deleteMany({ where: { courseId, department } });
  }

  revalidatePath("/dashboard/intern/verwaltung");
  revalidatePath("/dashboard/courses");
}

export async function deleteCourse(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const courseId = String(formData.get("courseId") ?? "");
  await prisma.course.delete({ where: { id: courseId } }).catch(() => null);

  revalidatePath("/dashboard/courses");
}

export async function togglePublish(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const courseId = String(formData.get("courseId") ?? "");
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return;

  await prisma.course.update({ where: { id: courseId }, data: { published: !course.published } });
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}`);
}

export async function setCourseAssignment(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const courseId = String(formData.get("courseId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const assign = formData.get("assign") === "true";

  if (assign) {
    await prisma.courseAssignment.upsert({
      where: { courseId_organizationId: { courseId, organizationId } },
      update: {},
      create: { courseId, organizationId },
    });
  } else {
    await prisma.courseAssignment.deleteMany({ where: { courseId, organizationId } });
  }

  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/courses");
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export async function createModule(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Module anlegen.";

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return "Kurs nicht gefunden.";

  let thumbnailUrl: string | null = null;
  try {
    thumbnailUrl = (await uploadImageField(formData, "thumbnail")) ?? null;
  } catch (error) {
    return error instanceof Error ? error.message : "Vorschaubild konnte nicht hochgeladen werden.";
  }

  const moduleCount = await prisma.module.count({ where: { courseId } });
  await prisma.module.create({
    data: { courseId, title, description: description || null, order: moduleCount, thumbnailUrl },
  });

  revalidatePath(`/dashboard/courses/${courseId}`);
  return undefined;
}

export async function updateModule(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Module bearbeiten.";

  const moduleId = String(formData.get("moduleId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";

  const courseModule = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!courseModule) return "Modul nicht gefunden.";

  let thumbnailUrl: string | null | undefined;
  try {
    thumbnailUrl = await uploadImageField(formData, "thumbnail");
  } catch (error) {
    return error instanceof Error ? error.message : "Vorschaubild konnte nicht hochgeladen werden.";
  }

  await prisma.module.update({
    where: { id: moduleId },
    data: {
      title,
      description: description || null,
      ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
    },
  });

  revalidatePath(`/dashboard/courses/${courseModule.courseId}`);
  return undefined;
}

export async function deleteModule(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const moduleId = String(formData.get("moduleId") ?? "");
  const courseModule = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!courseModule) return;

  await prisma.module.delete({ where: { id: moduleId } });
  revalidatePath(`/dashboard/courses/${courseModule.courseId}`);
}

export async function moveModule(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const moduleId = String(formData.get("moduleId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const courseModule = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!courseModule) return;

  const siblings = await prisma.module.findMany({
    where: { courseId: courseModule.courseId },
    orderBy: { order: "asc" },
  });
  const index = siblings.findIndex((m) => m.id === moduleId);
  const swapWithIndex = direction === "up" ? index - 1 : index + 1;
  if (swapWithIndex < 0 || swapWithIndex >= siblings.length) return;

  const swapWith = siblings[swapWithIndex];
  await prisma.$transaction([
    prisma.module.update({ where: { id: courseModule.id }, data: { order: swapWith.order } }),
    prisma.module.update({ where: { id: swapWith.id }, data: { order: courseModule.order } }),
  ]);

  revalidatePath(`/dashboard/courses/${courseModule.courseId}`);
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export async function createLesson(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Lektionen hinzufügen.";

  const moduleId = String(formData.get("moduleId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pdfUrl = String(formData.get("pdfUrl") ?? "").trim();
  const notionUrl = String(formData.get("notionUrl") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";

  const courseModule = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!courseModule) return "Modul nicht gefunden.";

  let videoUrl: string | null = null;
  const directVideoUrl = String(formData.get("videoUrl") ?? "").trim();
  if (directVideoUrl) {
    // Already uploaded straight to Blob from the browser (see
    // lesson-video-upload.tsx) - no size limit, nothing left to do here.
    videoUrl = directVideoUrl;
  } else {
    const video = formData.get("video");
    if (video instanceof File && video.size > 0) {
      videoUrl = await storeFile(video, "lessons");
    }
  }

  let thumbnailUrl: string | null = null;
  try {
    thumbnailUrl = (await uploadImageField(formData, "thumbnail")) ?? null;
  } catch (error) {
    return error instanceof Error ? error.message : "Vorschaubild konnte nicht hochgeladen werden.";
  }

  const lessonCount = await prisma.lesson.count({ where: { moduleId } });
  await prisma.lesson.create({
    data: {
      moduleId,
      title,
      description: description || null,
      order: lessonCount,
      videoUrl,
      thumbnailUrl,
      pdfUrl: pdfUrl || null,
      notionUrl: notionUrl || null,
    },
  });

  revalidatePath(`/dashboard/courses/${courseModule.courseId}`);
  return undefined;
}

export async function updateLesson(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Lektionen bearbeiten.";

  const lessonId = String(formData.get("lessonId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pdfUrl = String(formData.get("pdfUrl") ?? "").trim();
  const notionUrl = String(formData.get("notionUrl") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) return "Lektion nicht gefunden.";

  let thumbnailUrl: string | null | undefined;
  try {
    thumbnailUrl = await uploadImageField(formData, "thumbnail");
  } catch (error) {
    return error instanceof Error ? error.message : "Vorschaubild konnte nicht hochgeladen werden.";
  }

  // The block editor always submits a `content` field (its blocks, possibly
  // an empty array) - video is now one of those blocks rather than a
  // separate field, so videoUrl is derived from it and kept in sync purely
  // for the badges/icons elsewhere that check lesson.videoUrl directly
  // without parsing blocks. A caller that omits `content` entirely (none
  // currently exist) falls back to the old direct video/removeVideo fields.
  let content: LessonBlock[] | undefined;
  const contentRaw = formData.get("content");
  if (typeof contentRaw === "string") {
    try {
      content = parseLessonBlocks(contentRaw.trim() ? JSON.parse(contentRaw) : []);
    } catch {
      return "Inhalt konnte nicht gespeichert werden.";
    }
  }

  // A video block whose direct-to-blob upload failed client-side (e.g. no
  // Blob token configured) falls back to submitting its raw file through
  // this form under a per-block field name - upload it here and slot the
  // resulting URL into that exact block.
  if (content) {
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.type !== "video" || block.url) continue;
      const fallbackFile = formData.get(`videoBlockFile_${block.id}`);
      if (fallbackFile instanceof File && fallbackFile.size > 0) {
        content[i] = { ...block, url: await storeFile(fallbackFile, "lessons") };
      }
    }
  }

  let videoUrl: string | null | undefined;
  if (content !== undefined) {
    videoUrl = firstVideoBlockUrl(content);
  } else {
    const directVideoUrl = String(formData.get("videoUrl") ?? "").trim();
    if (directVideoUrl) {
      videoUrl = directVideoUrl;
    } else {
      const video = formData.get("video");
      if (video instanceof File && video.size > 0) {
        videoUrl = await storeFile(video, "lessons");
      } else if (formData.get("removeVideo") === "1") {
        videoUrl = null;
      }
    }
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title,
      description: description || null,
      pdfUrl: pdfUrl || null,
      notionUrl: notionUrl || null,
      ...(videoUrl !== undefined ? { videoUrl } : {}),
      ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
      ...(content !== undefined ? { content: content as unknown as Prisma.InputJsonValue } : {}),
    },
  });

  revalidatePath(`/dashboard/courses/${lesson.module.courseId}`);
  return undefined;
}

/** Uploads a single image picked for a lesson content block, returning its URL for the block editor's client-side state. */
export async function uploadLessonBlockImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { error: "Nur Agentur-Admins können Bilder hochladen." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei ausgewählt." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `Bild ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };

  const url = await storeFile(file, "lesson-content");
  return { url };
}

export async function deleteLesson(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const lessonId = String(formData.get("lessonId") ?? "");
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) return;

  await prisma.lesson.delete({ where: { id: lessonId } });
  revalidatePath(`/dashboard/courses/${lesson.module.courseId}`);
}

export async function moveLesson(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const lessonId = String(formData.get("lessonId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) return;

  const siblings = await prisma.lesson.findMany({
    where: { moduleId: lesson.moduleId },
    orderBy: { order: "asc" },
  });
  const index = siblings.findIndex((l) => l.id === lessonId);
  const swapWithIndex = direction === "up" ? index - 1 : index + 1;
  if (swapWithIndex < 0 || swapWithIndex >= siblings.length) return;

  const swapWith = siblings[swapWithIndex];
  await prisma.$transaction([
    prisma.lesson.update({ where: { id: lesson.id }, data: { order: swapWith.order } }),
    prisma.lesson.update({ where: { id: swapWith.id }, data: { order: lesson.order } }),
  ]);

  revalidatePath(`/dashboard/courses/${lesson.module.courseId}`);
}

// ---------------------------------------------------------------------------
// Learner progress
// ---------------------------------------------------------------------------

export async function toggleLessonComplete(formData: FormData) {
  const session = await requireSession();
  const lessonId = String(formData.get("lessonId") ?? "");
  const complete = formData.get("complete") === "true";

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) return;
  const courseId = lesson.module.courseId;

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: {},
    create: { userId: session.user.id, courseId },
  });

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    update: { completedAt: complete ? new Date() : null },
    create: { enrollmentId: enrollment.id, lessonId, completedAt: complete ? new Date() : null },
  });

  revalidatePath(`/dashboard/courses/${courseId}`);
}
