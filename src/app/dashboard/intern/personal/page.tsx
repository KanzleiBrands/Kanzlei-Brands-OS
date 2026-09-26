import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { getManagedUserIds } from "@/lib/hr-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { ArrowRightIcon, CakeIcon, PartyPopperIcon } from "lucide-react";
import { AbsenceTypeIcon } from "./abwesenheit/absence-type-icon";

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long" };

function nextOccurrence(date: Date, from: Date): Date {
  const next = new Date(from.getFullYear(), date.getMonth(), date.getDate());
  if (next < from) next.setFullYear(from.getFullYear() + 1);
  return next;
}

export default async function PersonalStartseite() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const isHrAdmin = session.user.role === "AGENCY_ADMIN";
  const managedUserIds = isHrAdmin ? [] : await getManagedUserIds(session.user.id, session.user.organizationId);
  const canReviewRequests = isHrAdmin || managedUserIds.length > 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const [me, absentToday, peopleWithEvents, pendingCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
    prisma.absenceRequest.findMany({
      where: {
        user: { organizationId: session.user.organizationId },
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: { absenceType: true, user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] },
        employmentEndedAt: null,
        OR: [{ birthday: { not: null } }, { hireDate: { not: null } }],
      },
      select: { id: true, name: true, avatarUrl: true, birthday: true, hireDate: true },
    }),
    canReviewRequests
      ? prisma.absenceRequest.count({
          where: isHrAdmin
            ? { status: "PENDING", user: { organizationId: session.user.organizationId } }
            : { status: "PENDING", userId: { in: managedUserIds } },
        })
      : Promise.resolve(0),
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Hallo {me?.name.split(" ")[0] ?? ""} 👋</h2>
        <p className="text-sm text-muted-foreground">Willkommen in deinem Personal-Bereich.</p>
      </div>

      {canReviewRequests && pendingCount > 0 && (
        <Link
          href="/dashboard/intern/personal/abwesenheit?tab=antraege"
          className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 p-4 text-sm ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
        >
          <p className="font-medium text-primary">
            {pendingCount} {pendingCount === 1 ? "Antrag wartet" : "Anträge warten"} auf deine Entscheidung
          </p>
          <ArrowRightIcon className="size-4 text-primary" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Abwesend heute</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {absentToday.length === 0 && <p className="text-sm text-muted-foreground">Heute ist niemand als abwesend eingetragen.</p>}
            {absentToday.map((request) => {
              const [firstName, ...rest] = request.user.name.trim().split(/\s+/);
              const lastName = rest.at(-1) ?? null;
              return (
                <div key={request.id} className="flex items-center gap-3 text-sm">
                  {request.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={request.user.avatarUrl} alt={request.user.name} className="size-8 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: avatarColorFor(request.user.name) }}
                    >
                      {initialsOf(firstName ?? null, lastName)}
                    </div>
                  )}
                  <p className="flex-1 font-medium">{request.user.name}</p>
                  <AbsenceTypeIcon icon={request.absenceType.icon} color={request.absenceType.color} className="size-3.5" />
                  <span className="text-xs text-muted-foreground">
                    bis {request.endDate.toLocaleDateString("de-DE")}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anstehende Ereignisse</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {events.length === 0 && <p className="text-sm text-muted-foreground">In den nächsten 30 Tagen steht nichts an.</p>}
            {events.map((event, index) => {
              const [firstName, ...rest] = event.name.trim().split(/\s+/);
              const lastName = rest.at(-1) ?? null;
              return (
                <div key={`${event.userId}-${event.kind}-${index}`} className="flex items-center gap-3 text-sm">
                  {event.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.avatarUrl} alt={event.name} className="size-8 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: avatarColorFor(event.name) }}
                    >
                      {initialsOf(firstName ?? null, lastName)}
                    </div>
                  )}
                  <p className="flex-1 font-medium">{event.name}</p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {event.kind === "birthday" ? <CakeIcon className="size-3.5" /> : <PartyPopperIcon className="size-3.5" />}
                    {event.date.toLocaleDateString("de-DE", SHORT_DATE)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schnellzugriff</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" nativeButton={false} render={<Link href="/dashboard/intern/personal/abwesenheit" />}>
            Abwesenheit beantragen
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/intern/personal/${session.user.id}`} />}>
            Mein Profil
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/intern/personal/verzeichnis" />}>
            Mitarbeiterverzeichnis
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
