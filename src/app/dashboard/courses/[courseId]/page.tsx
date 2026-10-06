import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3Icon, EyeIcon, PencilIcon } from "lucide-react";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseThumbnail } from "../course-thumbnail";
import { AddModuleForm } from "./add-module-form";
import { EditModuleDialog } from "./edit-module-dialog";
import { ModuleRowActions } from "./module-row-actions";
import { AddLessonForm } from "./add-lesson-form";
import { LessonRowActions } from "./lesson-row-actions";
import { EditCourseDialog } from "./edit-course-dialog";
import { DeleteCourseButton } from "./delete-course-button";
import { PublishToggle } from "../publish-toggle";
import { hasCourseAccess } from "@/lib/courses-access";
import { CourseDetailLearnerView } from "../course-detail-learner-view";
import { isSuperAdmin } from "@/lib/super-admin";
import { CourseDepartmentToggle } from "../../intern/course-department-toggle";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ preview?: string; manage?: string; tab?: string }>;
}) {
  const { courseId } = await params;
  const { preview, manage, tab } = await searchParams;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isAgency = session.user.role === "AGENCY_ADMIN";

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
      _count: { select: { assignments: true } },
      departmentAssignments: { select: { department: true } },
      enrollments: { where: { userId: session.user.id }, include: { progress: true } },
    },
  });
  if (!course) notFound();

  // Interne Kurse (audience=INTERNAL) sind vom Kunden-Kursbereich entkoppelt -
  // hier verwalten/bearbeiten/vorschauen darf nur der Super-Admin, sonst
  // könnte jeder Fulfillment-AGENCY_ADMIN eine interne Vertriebsschulung
  // öffnen, die nicht für ihn bestimmt ist (siehe
  // /dashboard/intern/schulung/verwaltung).
  const canManage = course.audience === "INTERNAL" ? isSuperAdmin(session.user.email) : isAgency;
  const isPreview = canManage && preview === "1";
  // manage=1 kommt explizit aus der Kursverwaltung (/dashboard/courses bzw.
  // /dashboard/intern/schulung/verwaltung) - ohne das lädt diese Seite immer
  // die Lerner-Ansicht, auch für Admins, damit sie im internen Portal ihre
  // eigenen Schulungen konsumieren können (siehe /dashboard/intern/schulung),
  // statt zwangsweise im Builder zu landen.
  const showBuilder = canManage && manage === "1" && !isPreview;

  if (!isAgency && !course.published) notFound();
  if (!showBuilder && !isPreview && !(await hasCourseAccess(session, course))) notFound();

  if (showBuilder) {
    const isInternal = course.audience === "INTERNAL";
    const activeTab = isInternal && tab === "mitglieder" ? "mitglieder" : "module";

    const assignedDepartments = course.departmentAssignments.map((a) => a.department);
    // Nur für die Mitglieder-Zuordnung geladen (interne Kurse, Super-Admin) -
    // nicht bei jedem Aufruf der Seite, um unnötige Query-Last zu vermeiden.
    const agencyUsers = isInternal
      ? await prisma.user.findMany({
          where: { organizationId: session.user.organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
          select: { id: true, name: true, departments: true },
          orderBy: { name: "asc" },
        })
      : [];
    const memberCount = isInternal
      ? agencyUsers.filter((u) => u.departments.some((d) => assignedDepartments.includes(d))).length
      : 0;

    return (
      <div className="p-4 sm:p-8">
        <BackLink href={isInternal ? "/dashboard/intern/schulung/verwaltung" : "/dashboard/courses"}>
          Zurück zur Kursverwaltung
        </BackLink>

        <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex w-full items-start gap-4 sm:w-auto">
            <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-24 shrink-0 rounded-lg sm:w-40" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold break-words sm:text-2xl">{course.title}</h1>
              {course.description && <p className="mt-1 text-muted-foreground">{course.description}</p>}
              <p className="mt-1 text-sm text-muted-foreground">
                {isInternal ? `${memberCount} Mitarbeiter zugewiesen` : `${course._count.assignments} Kunden zugewiesen`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/courses/${course.id}?preview=1`} />}
            >
              <EyeIcon className="size-4" />
              Vorschau
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/courses/${course.id}/progress`} />}
            >
              <BarChart3Icon className="size-4" />
              Lernfortschritt
            </Button>
            <PublishToggle courseId={course.id} published={course.published} />
            <EditCourseDialog
              courseId={course.id}
              title={course.title}
              description={course.description}
              thumbnailUrl={course.thumbnailUrl}
            />
            <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
          </div>
        </div>

        {isInternal && (
          <div className="mb-6 flex gap-1 border-b">
            <Link
              href={`/dashboard/courses/${course.id}?manage=1`}
              className={`flex-shrink-0 border-b-2 px-2.5 py-2 text-sm whitespace-nowrap ${
                activeTab === "module" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Module
            </Link>
            <Link
              href={`/dashboard/courses/${course.id}?manage=1&tab=mitglieder`}
              className={`flex-shrink-0 border-b-2 px-2.5 py-2 text-sm whitespace-nowrap ${
                activeTab === "mitglieder" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Mitglieder
            </Link>
          </div>
        )}

        {activeTab === "mitglieder" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Abteilungen auswählen, die Zugriff auf diese Schulung bekommen sollen - wer dazugehört, ergibt sich aus{" "}
              <Link href="/dashboard/settings" className="underline">
                Einstellungen → Mitarbeiter
              </Link>
              .
            </p>
            <div className="flex flex-col gap-3">
              {AGENCY_DEPARTMENTS.map((department) => {
                const members = agencyUsers.filter((u) => u.departments.includes(department));
                return (
                  <Card key={department}>
                    <CardContent className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <CourseDepartmentToggle
                          department={department}
                          courseId={course.id}
                          assigned={assignedDepartments.includes(department)}
                        />
                        {DEPARTMENT_LABELS[department]}
                      </label>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {members.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Noch niemand zugeordnet.</span>
                        ) : (
                          members.map((member) => (
                            <Badge key={member.id} variant="secondary">
                              {member.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Module</h2>
              <AddModuleForm courseId={course.id} />
            </div>

            <div className="flex flex-col gap-4">
              {course.modules.map((courseModule, moduleIndex) => (
            <Card key={courseModule.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <CourseThumbnail
                      src={courseModule.thumbnailUrl}
                      alt={courseModule.title}
                      className="w-16 shrink-0 rounded-md sm:w-24"
                    />
                    <div className="min-w-0">
                      <CardTitle className="text-base break-words">
                        {moduleIndex + 1}. {courseModule.title}
                      </CardTitle>
                      {courseModule.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{courseModule.description}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">{courseModule.lessons.length} Lektionen</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <EditModuleDialog
                      moduleId={courseModule.id}
                      title={courseModule.title}
                      description={courseModule.description}
                      thumbnailUrl={courseModule.thumbnailUrl}
                    />
                    <ModuleRowActions
                      moduleId={courseModule.id}
                      moduleTitle={courseModule.title}
                      canMoveUp={moduleIndex > 0}
                      canMoveDown={moduleIndex < course.modules.length - 1}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {courseModule.lessons.map((lesson, lessonIndex) => (
                  <div key={lesson.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{lessonIndex + 1}.</span>
                      <span>{lesson.title}</span>
                      {lesson.videoUrl && (
                        <Badge variant="outline" className="text-xs">
                          Video
                        </Badge>
                      )}
                      {lesson.pdfUrl && (
                        <Badge variant="outline" className="text-xs">
                          PDF
                        </Badge>
                      )}
                      {lesson.notionUrl && (
                        <Badge variant="outline" className="text-xs">
                          Notion
                        </Badge>
                      )}
                      {Array.isArray(lesson.content) && lesson.content.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Inhalt
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/courses/${course.id}/module/${courseModule.id}/lesson/${lesson.id}/edit`}
                        aria-label="Lektion bearbeiten"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <PencilIcon className="size-4" />
                      </Link>
                      <LessonRowActions
                        lessonId={lesson.id}
                        lessonTitle={lesson.title}
                        canMoveUp={lessonIndex > 0}
                        canMoveDown={lessonIndex < courseModule.lessons.length - 1}
                      />
                    </div>
                  </div>
                ))}
                {courseModule.lessons.length === 0 && (
                  <p className="text-sm text-muted-foreground">Noch keine Lektionen in diesem Modul.</p>
                )}
                <div className="mt-1">
                  <AddLessonForm moduleId={courseModule.id} />
                </div>
              </CardContent>
            </Card>
          ))}
              {course.modules.length === 0 && (
                <p className="text-muted-foreground">Noch keine Module. Lege das erste Modul an, um Lektionen hinzuzufügen.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- Learner (client) view - interne Kurse laufen primär über
  // /dashboard/intern/schulung/[courseId], das ist hier nur der Fallback für
  // alte Links/Bookmarks. ----
  return (
    <CourseDetailLearnerView
      course={course}
      basePath="/dashboard/courses"
      isPreview={isPreview}
      builderHref={`/dashboard/courses/${course.id}?manage=1`}
    />
  );
}
