import Link from "next/link";
import { Fragment } from "react";
import type { AgencyDepartment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { ContactCard } from "../hub/contact-card";
import { DepartmentResourcesCard } from "./department-resources-card";
import { getPageLayout } from "@/lib/page-layout";
import { DEPARTMENT_HUB_PAGE } from "@/lib/agency-departments";

const TEAM_EMAIL = "support@kanzlei-brands.de";

export async function DepartmentHubView({
  department,
  userId,
  editableResources,
}: {
  department: AgencyDepartment;
  userId: string;
  /** Nur wahr, wenn der Betrachter selbst AGENCY_ADMIN ist (kann Ressourcen direkt hier pflegen). */
  editableResources: boolean;
}) {
  const [viewer, resourceLinks, layout, courses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { manager: { select: { name: true, phone: true, calendlyUrl: true, avatarUrl: true } } },
    }),
    prisma.departmentResourceLink.findMany({ where: { department }, orderBy: { order: "asc" } }),
    getPageLayout(DEPARTMENT_HUB_PAGE[department]),
    prisma.course.findMany({
      where: { audience: "INTERNAL", published: true, departmentAssignments: { some: { department } } },
      include: {
        modules: { select: { lessons: { select: { id: true } } } },
        enrollments: { where: { userId }, include: { progress: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const manager = viewer?.manager ?? null;

  const sections: Record<string, React.ReactNode> = {
    department_contact: (
      <ContactCard
        title="Ansprechpartner"
        description="Deine Vorgesetzte oder dein Vorgesetzter laut Organigramm."
        contact={manager}
        emptyLabel="Du stehst an der Spitze der Organisation und hast keine übergeordnete Führungskraft."
        teamEmail={TEAM_EMAIL}
      />
    ),
    department_resources: (
      <DepartmentResourcesCard department={department} links={resourceLinks} editable={editableResources} />
    ),
    department_courses: (
      <Card>
        <CardHeader>
          <CardTitle>Schulungen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {courses.length === 0 && <p className="text-sm text-muted-foreground">Aktuell keine Schulungen zugewiesen.</p>}
          {courses.map((course) => {
            const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
            const completed = course.enrollments[0]?.progress.filter((p) => p.completedAt).length ?? 0;
            const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
            return (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3 transition-colors hover:border-primary"
              >
                <p className="min-w-0 flex-1 truncate font-medium">{course.title}</p>
                <CircularProgress percent={percent} size="sm" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {layout
        .filter((block) => block.enabled)
        .map((block) => <Fragment key={block.key}>{sections[block.key]}</Fragment>)}
    </div>
  );
}
