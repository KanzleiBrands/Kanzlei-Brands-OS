import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canApproveAbsenceFor, probationEndDate } from "@/lib/hr-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { DEPARTMENT_LABELS } from "@/lib/agency-departments";
import { EmployeeProfileForm } from "./employee-profile-form";
import { EmployeeDocumentsTab } from "./employee-documents-tab";

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long" };
const FULL_DATE_FMT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" };

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { userId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "profildaten" || tabParam === "dokumente" ? tabParam : "uebersicht";

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      manager: { select: { id: true, name: true } },
    },
  });
  if (!employee || employee.organizationId !== session.user.organizationId || (employee.role !== "AGENCY_ADMIN" && employee.role !== "AGENCY_STAFF")) {
    notFound();
  }

  const isSelf = session.user.id === employee.id;
  const isHrAdmin = session.user.role === "AGENCY_ADMIN";
  const canViewFull = isSelf || isHrAdmin || (await canApproveAbsenceFor(session, employee.id));

  const [firstName, ...rest] = employee.name.trim().split(/\s+/);
  const lastName = rest.at(-1) ?? null;

  if (!canViewFull) {
    // Kolleg*innen ohne Manager-Beziehung sehen nur die öffentliche Visitenkarte.
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          {employee.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.avatarUrl} alt={employee.name} className="size-16 rounded-full object-cover" />
          ) : (
            <div
              className="flex size-16 items-center justify-center rounded-full text-lg font-medium text-white"
              style={{ backgroundColor: avatarColorFor(employee.name) }}
            >
              {initialsOf(firstName ?? null, lastName)}
            </div>
          )}
          <p className="font-medium">{employee.name}</p>
          {employee.position && <p className="text-sm text-muted-foreground">{employee.position}</p>}
          {employee.department && <Badge variant="secondary">{DEPARTMENT_LABELS[employee.department]}</Badge>}
        </CardContent>
      </Card>
    );
  }

  const [documents, managerCandidates, upcomingAbsences] = await Promise.all([
    tab === "dokumente"
      ? prisma.employeeDocument.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    isHrAdmin
      ? prisma.user.findMany({
          where: { organizationId: session.user.organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.absenceRequest.findMany({
      where: { userId, status: "APPROVED", endDate: { gte: new Date() } },
      include: { absenceType: true },
      orderBy: { startDate: "asc" },
      take: 5,
    }),
  ]);

  const now = new Date();
  function nextOccurrence(date: Date | null) {
    if (!date) return null;
    const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    return next;
  }
  const nextBirthday = nextOccurrence(employee.birthday);
  const nextAnniversary = nextOccurrence(employee.hireDate);
  const probationEnd = probationEndDate(employee.hireDate);
  const probationEndsSoon = !!(probationEnd && probationEnd >= now && probationEnd.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        {employee.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={employee.avatarUrl} alt={employee.name} className="size-16 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-16 items-center justify-center rounded-full text-lg font-medium text-white"
            style={{ backgroundColor: avatarColorFor(employee.name) }}
          >
            {initialsOf(firstName ?? null, lastName)}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold">
            {employee.name} {employee.employmentEndedAt && <Badge variant="outline">Inaktiv</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">
            {[employee.position, employee.location].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-foreground/10">
        {[
          { key: "uebersicht", label: "Übersicht" },
          { key: "profildaten", label: "Profildaten" },
          { key: "dokumente", label: "Dokumente" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/intern/personal/${userId}?tab=${t.key}`}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "uebersicht" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Über {employee.name.split(" ")[0]}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Geburtstag:</span>{" "}
                {employee.birthday ? employee.birthday.toLocaleDateString("de-DE", DATE_FMT) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Unternehmensbeitritt:</span>{" "}
                {employee.hireDate ? employee.hireDate.toLocaleDateString("de-DE", FULL_DATE_FMT) : "—"}
              </p>
              {probationEnd && (
                <p>
                  <span className="text-muted-foreground">Probezeit endet:</span>{" "}
                  {probationEnd.toLocaleDateString("de-DE", FULL_DATE_FMT)}
                  {probationEndsSoon && (
                    <Badge variant="outline" className="ml-2">
                      bald
                    </Badge>
                  )}
                  {probationEnd < now && (
                    <span className="ml-2 text-xs text-muted-foreground">(beendet)</span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unternehmensstruktur</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Manager*in:</span> {employee.manager?.name ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Gruppe:</span>{" "}
                {employee.department ? DEPARTMENT_LABELS[employee.department] : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Abwesenheiten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {upcomingAbsences.length === 0 && <p className="text-muted-foreground">Keine anstehenden Abwesenheiten.</p>}
              {upcomingAbsences.map((absence) => (
                <p key={absence.id}>
                  {absence.absenceType.name}: {absence.startDate.toLocaleDateString("de-DE")} –{" "}
                  {absence.endDate.toLocaleDateString("de-DE")} ({absence.days} Tage)
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ereignisse</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {!nextBirthday && !nextAnniversary && <p className="text-muted-foreground">Keine Daten hinterlegt.</p>}
              {nextBirthday && <p>Geburtstag: {nextBirthday.toLocaleDateString("de-DE", DATE_FMT)}</p>}
              {nextAnniversary && <p>Jubiläum: {nextAnniversary.toLocaleDateString("de-DE", DATE_FMT)}</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "profildaten" &&
        (isHrAdmin ? (
          <EmployeeProfileForm
            userId={employee.id}
            position={employee.position}
            location={employee.location}
            department={employee.department}
            managerId={employee.managerId}
            birthday={employee.birthday}
            hireDate={employee.hireDate}
            active={!employee.employmentEndedAt}
            managerCandidates={managerCandidates}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nur Agentur-Admins können Profildaten bearbeiten.
          </p>
        ))}

      {tab === "dokumente" && (
        <EmployeeDocumentsTab
          userId={employee.id}
          documents={documents.map((d) => ({ ...d, documentDate: d.documentDate?.toISOString() ?? null }))}
          editable={isHrAdmin}
        />
      )}
    </div>
  );
}
