import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { computeOverviewStats } from "@/lib/dashboard-stats";
import { StatTile } from "@/components/stat-tile";
import { StatusDistributionBar } from "@/components/status-distribution-bar";
import { NewUserForm } from "./new-user-form";
import { NewPipelineForm } from "./new-pipeline-form";
import { PipelineAccessToggle } from "./pipeline-access-toggle";
import { CourseAssignmentToggle } from "./course-assignment-toggle";
import { ActivationStatus } from "@/components/activation-status";
import { getBaseUrl } from "@/lib/base-url";

export default async function ClientDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      users: { orderBy: { createdAt: "asc" }, include: { pipelineAccess: true } },
      pipelines: {
        orderBy: { createdAt: "asc" },
        include: {
          stages: { select: { id: true, name: true, order: true, color: true } },
          contacts: { select: { id: true, stageId: true, createdAt: true, updatedAt: true } },
        },
      },
      courseAssignments: { select: { courseId: true } },
    },
  });

  if (!organization || organization.type !== "CLIENT") notFound();

  const staff = organization.users.filter((u) => u.role === "CLIENT_STAFF");
  const stats = computeOverviewStats(organization.pipelines);
  const baseUrl = await getBaseUrl();
  const courses = await prisma.course.findMany({ orderBy: { createdAt: "desc" } });
  const assignedCourseIds = new Set(organization.courseAssignments.map((a) => a.courseId));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">{organization.name}</h1>
          <p className="text-muted-foreground">Kunden-Portal (Agentur-Ansicht)</p>
        </div>
        <Link href={`/dashboard/audit-log?orgId=${organization.id}`} className="text-sm text-muted-foreground underline">
          Audit-Log ansehen →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Neu in 7 Tagen"
          value={stats.newLast7Days}
          subtext={`${stats.totalContacts} Kontakte gesamt`}
        />
        <StatTile
          label="Unbearbeitet"
          value={stats.unprocessed}
          subtext={`${stats.staleUnprocessed} seit über 2 Tagen offen`}
        />
        <StatTile label="In Bearbeitung" value={stats.inProgress} subtext="aktuell in Bearbeitung" />
        <StatTile
          label="Abgeschlossen in 30 Tagen"
          value={stats.completedLast30Days}
          subtext={`${stats.completedTotal} gesamt`}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statusverteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusDistributionBar segments={stats.statusDistribution} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Mitarbeiter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewUserForm organizationId={organization.id} canAssignAdmin />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Zugang</TableHead>
                <TableHead>Kampagnen-Zugriff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.users.map((user) => {
                const activationLink =
                  user.activationToken && user.activationTokenExpiresAt && user.activationTokenExpiresAt > new Date()
                    ? `${baseUrl}/activate/${user.activationToken}`
                    : null;
                return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "CLIENT_ADMIN" ? "default" : "secondary"}>
                      {user.role === "CLIENT_ADMIN" ? "Admin" : "Mitarbeiter"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ActivationStatus userId={user.id} isActive={!!user.passwordHash} activationLink={activationLink} />
                  </TableCell>
                  <TableCell>
                    {user.role === "CLIENT_STAFF" ? (
                      <div className="flex flex-wrap gap-3">
                        {organization.pipelines.map((pipeline) => {
                          const granted = user.pipelineAccess.some((a) => a.pipelineId === pipeline.id);
                          return (
                            <label key={pipeline.id} className="flex items-center gap-1 text-sm">
                              <PipelineAccessToggle userId={user.id} pipelineId={pipeline.id} granted={granted} />
                              {pipeline.name}
                            </label>
                          );
                        })}
                        {organization.pipelines.length === 0 && (
                          <span className="text-sm text-muted-foreground">Keine Kampagnen vorhanden</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Voller Zugriff (Admin)</span>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Kampagnen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewPipelineForm organizationId={organization.id} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.pipelines.map((pipeline) => (
                <TableRow key={pipeline.id}>
                  <TableCell className="font-medium">{pipeline.name}</TableCell>
                  <TableCell>{pipeline.kind === "LEADS" ? "Leads (CRM)" : "Bewerber (ATS)"}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/pipelines/${pipeline.id}`} className="text-sm underline">
                      Öffnen
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {organization.pipelines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Noch keine Kampagnen.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Schulung</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Wähle, welche Kurse dieser Kunde in seinem Schulungsbereich sehen kann.
          </p>
          <div className="flex flex-wrap gap-3">
            {courses.map((course) => (
              <label key={course.id} className="flex items-center gap-1.5 text-sm">
                <CourseAssignmentToggle
                  organizationId={organization.id}
                  courseId={course.id}
                  assigned={assignedCourseIds.has(course.id)}
                />
                {course.title}
              </label>
            ))}
            {courses.length === 0 && <span className="text-sm text-muted-foreground">Noch keine Kurse angelegt.</span>}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {staff.length} Mitarbeiter · {organization.pipelines.length} Kampagnen
      </p>
    </div>
  );
}
