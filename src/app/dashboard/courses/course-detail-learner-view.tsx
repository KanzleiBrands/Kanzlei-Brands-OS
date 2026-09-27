import Link from "next/link";
import { ChevronRightIcon, EyeIcon } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CourseThumbnail } from "./course-thumbnail";
import { CourseBanner } from "./course-banner";
import { formatLessonMeta } from "./course-format";

type CourseForLearnerView = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  modules: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    lessons: { id: string; moduleId: string; title: string; durationSeconds: number | null }[];
  }[];
  enrollments: { progress: { lessonId: string; completedAt: Date | null }[] }[];
};

/**
 * Geteilte Lerner-Ansicht eines Kurses - von /dashboard/courses/[courseId]
 * (Kunden-Kurse, plus Fallback für interne Kurse) UND
 * /dashboard/intern/schulung/[courseId] (interne Kurse, primärer Pfad)
 * genutzt, damit Verbesserungen für beide Instanzen gelten. `basePath` legt
 * fest, in welchem URL-Baum Modul-/Lektions-Links und der "Zurück"-Link
 * bleiben - so verlässt das interne Portal beim Lernen nie /dashboard/intern.
 */
export function CourseDetailLearnerView({
  course,
  basePath,
  isPreview = false,
  builderHref,
}: {
  course: CourseForLearnerView;
  basePath: string;
  /** Nur für den Kundenverwaltungs-Kontext (/dashboard/courses?preview=1) - im internen Portal nie true. */
  isPreview?: boolean;
  /** Ziel für "Zurück zum Builder" im Vorschaumodus. */
  builderHref?: string;
}) {
  const completedLessonIds = new Set(
    (course.enrollments[0]?.progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId),
  );

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
  const overallPercent = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

  const nextLesson = allLessons.find((l) => !completedLessonIds.has(l.id));
  const nextLessonModule = nextLesson ? course.modules.find((m) => m.id === nextLesson.moduleId) : null;

  const previewQuery = isPreview ? "?preview=1" : "";

  return (
    <div className="p-4 sm:p-8">
      {isPreview && builderHref ? (
        <BackLink href={builderHref}>Zurück zum Builder</BackLink>
      ) : (
        <BackLink href={basePath}>Zurück zu meinen Kursen</BackLink>
      )}

      {isPreview && (
        <div className="mt-2 mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          <EyeIcon className="size-4 shrink-0" />
          Vorschaumodus - so sieht der Kurs für Kunden aus.
        </div>
      )}

      <div className="mt-2 mb-6">
        <CourseBanner
          thumbnailUrl={course.thumbnailUrl}
          eyebrow="Kurs"
          title={course.title}
          right={<CircularProgress percent={overallPercent} size="lg" tone="onDark" />}
        />
      </div>

      {nextLesson && nextLessonModule && (
        <Link
          href={`${basePath}/${course.id}/module/${nextLessonModule.id}/lesson/${nextLesson.id}${previewQuery}`}
          className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-neutral-900 p-3 pr-4 transition-colors hover:bg-neutral-800"
        >
          <div className="flex min-w-0 items-center gap-3">
            <CourseThumbnail
              src={nextLessonModule.thumbnailUrl}
              alt=""
              className="w-12 shrink-0 rounded-md sm:w-20"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/50 uppercase">Mache direkt weiter!</p>
              <p className="line-clamp-2 font-medium break-words text-white">{nextLesson.title}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-900 sm:px-3">
            <span className="hidden sm:inline">Fortsetzen</span>
            <ChevronRightIcon className="size-4" />
          </span>
        </Link>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-primary" />
        <h2 className="text-lg font-semibold">Module</h2>
      </div>
      <div className="flex flex-col gap-3">
        {course.modules.map((courseModule, moduleIndex) => {
          const moduleLessons = courseModule.lessons;
          const moduleCompleted = moduleLessons.filter((l) => completedLessonIds.has(l.id)).length;
          const modulePercent = moduleLessons.length > 0 ? (moduleCompleted / moduleLessons.length) * 100 : 0;
          const totalDuration = moduleLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
          return (
            <Link
              key={courseModule.id}
              href={`${basePath}/${course.id}/module/${courseModule.id}${previewQuery}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CourseThumbnail
                  src={courseModule.thumbnailUrl}
                  alt={courseModule.title}
                  className="w-16 shrink-0 rounded-lg sm:w-32"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium break-words">
                    Modul {moduleIndex + 1} – {courseModule.title}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground uppercase">
                    {formatLessonMeta(moduleLessons.length, totalDuration)}
                  </p>
                </div>
              </div>
              <CircularProgress percent={modulePercent} size="sm" className="shrink-0" />
            </Link>
          );
        })}
        {course.modules.length === 0 && <p className="text-muted-foreground">Noch keine Inhalte in diesem Kurs.</p>}
      </div>
    </div>
  );
}
