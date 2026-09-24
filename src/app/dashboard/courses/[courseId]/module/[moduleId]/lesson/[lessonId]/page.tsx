import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2Icon, CircleIcon, EyeIcon, FileTextIcon, ChevronRightIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "../../../../../course-thumbnail";
import { CourseBanner } from "../../../../../course-banner";
import { formatLessonMeta } from "../../../../../course-format";
import { parseLessonBlocks } from "@/lib/lesson-blocks";
import { LessonCompleteButton } from "./lesson-complete-button";

export default async function LessonPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { courseId, moduleId, lessonId } = await params;
  const { preview } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const isPreview = session.user.role === "AGENCY_ADMIN" && preview === "1";
  if (session.user.role === "AGENCY_ADMIN" && !isPreview) redirect(`/dashboard/courses/${courseId}`);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course || (!course.published && !isPreview)) notFound();

  if (!isPreview) {
    const assigned = await prisma.courseAssignment.findFirst({
      where: { courseId, organizationId: session.user.organizationId },
    });
    if (!assigned) notFound();
  }

  const currentModule = course.modules.find((m) => m.id === moduleId);
  const lesson = currentModule?.lessons.find((l) => l.id === lessonId);
  if (!currentModule || !lesson) notFound();
  const contentBlocks = parseLessonBlocks(lesson.content);
  // Video used to be a fixed field rendered above everything else; a lesson
  // that was never re-saved through the block editor still only has it
  // there, not as a block, so fall back to showing it in that old spot.
  const hasVideoBlock = contentBlocks.some((b) => b.type === "video" && b.url);

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    include: { progress: true },
  });
  const completedLessonIds = new Set(
    (enrollment?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );

  const allLessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const nextLesson = allLessons[currentIndex + 1];

  const moduleCompletedCount = currentModule.lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const modulePercent =
    currentModule.lessons.length > 0 ? (moduleCompletedCount / currentModule.lessons.length) * 100 : 0;

  const previewQuery = isPreview ? "?preview=1" : "";

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:p-8 lg:grid-cols-[1fr_320px]">
      <div>
        {isPreview && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
            <EyeIcon className="size-4 shrink-0" />
            Vorschaumodus - so sieht der Kurs für Kunden aus.
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href={`/dashboard/courses/${course.id}${previewQuery}`} className="hover:underline">
            {course.title}
          </Link>
          <ChevronRightIcon className="size-3.5" />
          <Link href={`/dashboard/courses/${course.id}/module/${currentModule.id}${previewQuery}`} className="hover:underline">
            {currentModule.title}
          </Link>
          <ChevronRightIcon className="size-3.5" />
          <span>{lesson.title}</span>
        </div>

        <div className="mb-4">
          <CourseBanner
            thumbnailUrl={currentModule.thumbnailUrl}
            eyebrow={course.title}
            title={currentModule.title}
            size="md"
            right={<CircularProgress percent={modulePercent} tone="onDark" />}
          />
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <h1 className="mb-3 text-xl font-semibold">{lesson.title}</h1>

          {!hasVideoBlock &&
            (lesson.videoUrl ? (
              <div className="overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
                <video src={lesson.videoUrl} controls className="size-full object-contain" />
              </div>
            ) : lesson.thumbnailUrl ? (
              <div className="overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lesson.thumbnailUrl} alt={lesson.title} className="size-full object-contain" />
              </div>
            ) : null)}

          {lesson.description && <p className="mt-4 text-sm text-muted-foreground">{lesson.description}</p>}

          {contentBlocks.length > 0 && (
            <div className="mt-6 flex flex-col gap-4">
              {contentBlocks.map((block) => {
                if (block.type === "heading") {
                  const Tag = block.level === 2 ? "h2" : "h3";
                  return (
                    <Tag key={block.id} className={block.level === 2 ? "text-lg font-semibold" : "font-medium"}>
                      {block.text}
                    </Tag>
                  );
                }
                if (block.type === "paragraph") {
                  return (
                    <p key={block.id} className="text-sm whitespace-pre-line text-muted-foreground">
                      {block.text}
                    </p>
                  );
                }
                if (block.type === "video") {
                  if (!block.url) return null;
                  return (
                    <div key={block.id} className="overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
                      <video src={block.url} controls className="size-full object-contain" />
                    </div>
                  );
                }
                if (block.type === "image") {
                  if (!block.url) return null;
                  return (
                    <figure key={block.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={block.url}
                        alt={block.caption}
                        className="max-h-[480px] w-auto max-w-full rounded-lg object-contain"
                      />
                      {block.caption && (
                        <figcaption className="mt-1.5 text-xs text-muted-foreground">{block.caption}</figcaption>
                      )}
                    </figure>
                  );
                }
                return null;
              })}
            </div>
          )}

          {(lesson.pdfUrl || lesson.notionUrl) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {lesson.pdfUrl && (
                <a
                  href={lesson.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:border-primary"
                >
                  <FileTextIcon className="size-4" />
                  PDF öffnen
                </a>
              )}
              {lesson.notionUrl && (
                <a
                  href={lesson.notionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:border-primary"
                >
                  <FileTextIcon className="size-4" />
                  Notion-Doc öffnen
                </a>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <LessonCompleteButton
              lessonId={lesson.id}
              completed={completedLessonIds.has(lesson.id)}
              disabled={isPreview}
            />
            {nextLesson && (
              <Link
                href={`/dashboard/courses/${course.id}/module/${nextLesson.moduleId}/lesson/${nextLesson.id}${previewQuery}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Nächste Lektion
                <ChevronRightIcon className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold">{currentModule.title}</p>
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {formatLessonMeta(currentModule.lessons.length, 0)}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {currentModule.lessons.map((l, index) => {
            const completed = completedLessonIds.has(l.id);
            const active = l.id === lessonId;
            return (
              <Link
                key={l.id}
                href={`/dashboard/courses/${course.id}/module/${currentModule.id}/lesson/${l.id}${previewQuery}`}
                className={`flex items-center gap-2 rounded-lg p-1.5 text-sm transition-colors ${
                  active ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                }`}
              >
                <CourseThumbnail src={l.thumbnailUrl ?? currentModule.thumbnailUrl} alt="" className="w-16 shrink-0 rounded-md" />
                <span className="line-clamp-2 min-w-0 flex-1">
                  {index + 1}. {l.title}
                </span>
                {completed ? (
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
