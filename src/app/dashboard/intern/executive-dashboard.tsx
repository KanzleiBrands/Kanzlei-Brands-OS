import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { ArrowRightIcon, CakeIcon, PartyPopperIcon, MegaphoneIcon, UsersIcon } from "lucide-react";
import { AbsenceTypeIcon } from "./personal/abwesenheit/absence-type-icon";

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long" };

function nextOccurrence(date: Date, from: Date): Date {
  const next = new Date(from.getFullYear(), date.getMonth(), date.getDate());
  if (next < from) next.setFullYear(from.getFullYear() + 1);
  return next;
}

/**
 * "Mein Dashboard" für die Geschäftsführung (department=EXECUTIVE) - eine
 * Zusammenfassung aus jedem Bereich des internen Portals, statt des
 * generischen Abteilungs-Hubs (Ansprechpartner/Assets/Schulungen) oder gar
 * der Verwaltungsseite. Abteilungs-/Mitarbeiter-Konfiguration bleibt
 * bewusst separat unter "Abteilungen & Mitarbeiter".
 */
export async function ExecutiveDashboard({
  name,
  userId,
  organizationId,
}: {
  name: string;
  userId: string;
  organizationId: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  const [
    pendingAbsenceCount,
    absentToday,
    peopleWithEvents,
    employeesByDepartment,
    scheduledPostsCount,
    draftPostsCount,
    whatsappSentThisMonth,
  ] = await Promise.all([
    prisma.absenceRequest.count({ where: { status: "PENDING", user: { organizationId } } }),
    prisma.absenceRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today }, user: { organizationId } },
      include: { absenceType: true, user: { select: { name: true, avatarUrl: true } } },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] },
        employmentEndedAt: null,
        OR: [{ birthday: { not: null } }, { hireDate: { not: null } }],
      },
      select: { id: true, name: true, avatarUrl: true, birthday: true, hireDate: true },
    }),
    prisma.user.groupBy({
      by: ["department"],
      where: { organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] }, employmentEndedAt: null },
      _count: { _all: true },
    }),
    prisma.socialPost.count({ where: { organizationId, status: "SCHEDULED", scheduledAt: { lte: in7Days } } }),
    prisma.socialPost.count({ where: { organizationId, status: { in: ["IDEA", "IN_PRODUCTION"] } } }),
    prisma.whatsAppTemplateSend.count({
      where: { channel: { organizationId }, status: "SENT", createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } },
    }),
  ]);

  const events: { userId: string; name: string; avatarUrl: string | null; date: Date; kind: "birthday" | "anniversary" }[] = [];
  for (const person of peopleWithEvents) {
    if (person.birthday) {
      const date = nextOccurrence(person.birthday, today);
      if (date <= in30Days) events.push({ userId: person.id, name: person.name, avatarUrl: person.avatarUrl, date, kind: "birthday" });
    }
    if (person.hireDate) {
      const date = nextOccurrence(person.hireDate, today);
      if (date <= in30Days) events.push({ userId: person.id, name: person.name, avatarUrl: person.avatarUrl, date, kind: "anniversary" });
    }
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalEmployees = employeesByDepartment.reduce((sum, d) => sum + d._count._all, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Hallo {name.split(" ")[0]} 👋</h2>
        <p className="text-sm text-muted-foreground">Dein Überblick über Kanzlei Brands - alles auf einen Blick.</p>
      </div>

      {pendingAbsenceCount > 0 && (
        <Link
          href="/dashboard/intern/personal/abwesenheit?tab=antraege"
          className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 p-4 text-sm ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
        >
          <p className="font-medium text-primary">
            {pendingAbsenceCount} {pendingAbsenceCount === 1 ? "Abwesenheitsantrag wartet" : "Abwesenheitsanträge warten"} auf Entscheidung
          </p>
          <ArrowRightIcon className="size-4 text-primary" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Personal</CardTitle>
            <Link href="/dashboard/intern/personal" className="text-xs text-muted-foreground hover:text-foreground">
              Öffnen →
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <UsersIcon className="size-4 text-muted-foreground" />
              <span>{totalEmployees} Mitarbeiter:innen gesamt</span>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Heute abwesend</p>
              {absentToday.length === 0 && <p className="text-sm text-muted-foreground">Niemand als abwesend eingetragen.</p>}
              {absentToday.map((request) => {
                const [firstName, ...rest] = request.user.name.trim().split(/\s+/);
                const lastName = rest.at(-1) ?? null;
                return (
                  <div key={request.id} className="flex items-center gap-2 py-0.5 text-sm">
                    {request.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={request.user.avatarUrl} alt={request.user.name} className="size-6 rounded-full object-cover" />
                    ) : (
                      <div
                        className="flex size-6 items-center justify-center rounded-full text-[0.6rem] font-medium text-white"
                        style={{ backgroundColor: avatarColorFor(request.user.name) }}
                      >
                        {initialsOf(firstName ?? null, lastName)}
                      </div>
                    )}
                    <span className="flex-1">{request.user.name}</span>
                    <AbsenceTypeIcon icon={request.absenceType.icon} color={request.absenceType.color} className="size-3.5" />
                  </div>
                );
              })}
            </div>
            {events.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Nächste Ereignisse</p>
                {events.slice(0, 3).map((event, index) => (
                  <div key={`${event.userId}-${event.kind}-${index}`} className="flex items-center gap-2 py-0.5 text-sm">
                    {event.kind === "birthday" ? (
                      <CakeIcon className="size-3.5 text-muted-foreground" />
                    ) : (
                      <PartyPopperIcon className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="flex-1">{event.name}</span>
                    <span className="text-xs text-muted-foreground">{event.date.toLocaleDateString("de-DE", SHORT_DATE)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Marketing</CardTitle>
            <Link href="/dashboard/intern/marketing" className="text-xs text-muted-foreground hover:text-foreground">
              Öffnen →
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <MegaphoneIcon className="size-4 text-muted-foreground" />
              <span>{scheduledPostsCount} Beitrag/Beiträge in den nächsten 7 Tagen geplant</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {draftPostsCount} Beitrag/Beiträge noch in Idee/Produktion
            </p>
            {whatsappSentThisMonth > 0 && (
              <p className="text-sm text-muted-foreground">{whatsappSentThisMonth} WhatsApp-Nachrichten diesen Monat verschickt</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team nach Abteilung</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {employeesByDepartment.map((d) => (
            <span key={d.department ?? "none"} className="rounded-full bg-muted px-3 py-1 text-sm">
              {d.department ?? "Ohne Abteilung"}: {d._count._all}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schnellzugriff</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/intern/personal/${userId}`} />}>
            Mein Profil
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/intern/verwaltung" />}>
            Abteilungen &amp; Mitarbeiter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
