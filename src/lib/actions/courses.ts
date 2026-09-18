"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { storeLessonVideo } from "@/lib/video-storage";

export async function createCourse(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Kurse anlegen.";

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "TRAINING");
  if (!title) return "Titel ist erforderlich.";
  if (category !== "ONBOARDING" && category !== "TRAINING") return "Ungültige Kategorie.";

  await prisma.course.create({
    data: { title, description: description || null, category },
  });

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

export async function addLesson(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Lektionen hinzufügen.";

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const video = formData.get("video");

  if (!title) return "Titel ist erforderlich.";

  let videoUrl: string | null = null;
  if (video instanceof File && video.size > 0) {
    videoUrl = await storeLessonVideo(video);
  }

  const lessonCount = await prisma.lesson.count({ where: { courseId } });
  await prisma.lesson.create({
    data: { courseId, title, order: lessonCount, videoUrl },
  });

  revalidatePath(`/dashboard/courses/${courseId}`);
}

export async function toggleLessonComplete(formData: FormData) {
  const session = await requireSession();
  const courseId = String(formData.get("courseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const complete = formData.get("complete") === "true";

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
