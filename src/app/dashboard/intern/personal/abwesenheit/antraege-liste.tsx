import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { AbsenceTypeIcon } from "./absence-type-icon";
import { DecideRequestButtons } from "./decide-request-buttons";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ausstehend",
  APPROVED: "Genehmigt",
  DECLINED: "Abgelehnt",
  CANCELLED: "Storniert",
};

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  PENDING: "outline",
  APPROVED: "default",
  DECLINED: "destructive",
  CANCELLED: "secondary",
};

export async function AntraegeListe({
  session,
  isHrAdmin,
  managedUserIds,
}: {
  session: Session;
  isHrAdmin: boolean;
  managedUserIds: string[];
}) {
  const where = isHrAdmin
    ? { user: { organizationId: session.user.organizationId } }
    : { userId: { in: managedUserIds } };

  const requests = await prisma.absenceRequest.findMany({
    where,
    include: { absenceType: true, user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  function requestRow(request: (typeof requests)[number]) {
    const [firstName, ...rest] = request.user.name.trim().split(/\s+/);
    const lastName = rest.at(-1) ?? null;
    return (
      <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3 text-sm">
        <div className="flex items-center gap-3">
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
          <AbsenceTypeIcon icon={request.absenceType.icon} color={request.absenceType.color} />
          <div>
            <p className="font-medium">
              {request.user.name} · {request.absenceType.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {request.startDate.toLocaleDateString("de-DE")} – {request.endDate.toLocaleDateString("de-DE")} ({request.days} Tage)
            </p>
            {request.note && <p className="text-xs text-muted-foreground">„{request.note}“</p>}
          </div>
        </div>
        {request.status === "PENDING" ? (
          <DecideRequestButtons requestId={request.id} />
        ) : (
          <Badge variant={STATUS_VARIANTS[request.status]}>{STATUS_LABELS[request.status]}</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Offene Anträge</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Anträge.</p>}
          {pending.map(requestRow)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historie</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {decided.length === 0 && <p className="text-sm text-muted-foreground">Noch keine entschiedenen Anträge.</p>}
          {decided.map(requestRow)}
        </CardContent>
      </Card>
    </div>
  );
}
