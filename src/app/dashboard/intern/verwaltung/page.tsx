import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentResourcesCard } from "../department-resources-card";
import { DepartmentContactSelect } from "../department-contact-select";
import { CourseDepartmentToggle } from "../course-department-toggle";
import { AGENCY_DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/agency-departments";

export default async function InternalPortalAdminPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard/intern");

  const [agencyUsers, resourceLinks, contactRows, internalCourses] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
      select: { id: true, name: true, role: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.departmentResourceLink.findMany({ orderBy: { order: "asc" } }),
    prisma.departmentContact.findMany(),
    prisma.course.findMany({
      where: { audience: "INTERNAL" },
      select: { id: true, title: true, departmentAssignments: { select: { department: true } } },
      orderBy: { title: "asc" },
    }),
  ]);

  const admins = agencyUsers.filter((u) => u.role === "AGENCY_ADMIN");
  const contactByDepartment = new Map(contactRows.map((c) => [c.department, c.contactUserId]));

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Internes Portal – Verwaltung</h1>
      <p className="mb-6 text-muted-foreground">
        Ansprechpartner, Assets und Mitarbeiter je Abteilung pflegen. Neue Mitarbeiter lädst du in{" "}
        <Link href="/dashboard/settings" className="underline">
          Einstellungen → Mitarbeiter
        </Link>{" "}
        ein.
      </p>

      <div className="flex flex-col gap-6">
        {AGENCY_DEPARTMENTS.map((department) => {
          const members = agencyUsers.filter((u) => u.department === department);
          return (
            <Card key={department}>
              <CardHeader>
                <CardTitle>{DEPARTMENT_LABELS[department]}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">Ansprechpartner</p>
                  <DepartmentContactSelect
                    department={department}
                    contactUserId={contactByDepartment.get(department) ?? null}
                    candidates={admins}
                  />
                </div>

                <DepartmentResourcesCard
                  department={department}
                  links={resourceLinks.filter((l) => l.department === department)}
                  editable
                  bare
                />

                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">Mitarbeiter</p>
                  {members.length === 0 && <p className="text-sm text-muted-foreground">Noch niemand zugeordnet.</p>}
                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => (
                      <Badge key={member.id} variant="secondary">
                        {member.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">Zugewiesene Schulungen</p>
                  {internalCourses.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Noch keine internen Kurse angelegt (
                      <Link href="/dashboard/courses" className="underline">
                        Schulung
                      </Link>
                      , Zielgruppe &quot;Mitarbeiter&quot;).
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {internalCourses.map((course) => (
                      <label key={course.id} className="flex items-center gap-2 text-sm">
                        <CourseDepartmentToggle
                          department={department}
                          courseId={course.id}
                          assigned={course.departmentAssignments.some((a) => a.department === department)}
                        />
                        {course.title}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" size="sm" className="mt-6" nativeButton={false} render={<Link href="/dashboard/clients" />}>
        Zurück zum Kundenportal
      </Button>
    </div>
  );
}
