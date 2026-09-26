import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAbsenceBalances } from "@/lib/hr-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AbsenceRequestDialog } from "./absence-request-dialog";
import { AbsenceTypeIcon } from "./absence-type-icon";
import { CancelRequestButton } from "./cancel-request-button";

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

export async function MeineAbwesenheiten({ session }: { session: Session }) {
  const year = new Date().getFullYear();

  const [me, balances, absenceTypes, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, position: true, avatarUrl: true } }),
    getAbsenceBalances(session.user.id, year),
    prisma.absenceType.findMany({ where: { archivedAt: null }, orderBy: { order: "asc" } }),
    prisma.absenceRequest.findMany({
      where: { userId: session.user.id },
      include: { absenceType: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Deine Kontingente und Anträge für {year}.</p>
        {me && (
          <AbsenceRequestDialog
            me={{ name: me.name, position: me.position, avatarUrl: me.avatarUrl }}
            absenceTypes={absenceTypes.map((t) => ({ id: t.id, name: t.name }))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((balance) => (
          <Card key={balance.type.id}>
            <CardContent className="flex items-center gap-3 py-4">
              <AbsenceTypeIcon icon={balance.type.icon} color={balance.type.color} className="size-5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{balance.type.name}</p>
                {balance.type.allowanceType === "LIMITED" ? (
                  <p className="text-xs text-muted-foreground">
                    {balance.remainingDays} von {balance.totalDays} Tagen übrig
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Unbegrenzt{balance.usedDays > 0 ? ` · ${balance.usedDays} Tage in ${year}` : ""}
                    {balance.type.weeklyCapDays ? ` · bis zu ${balance.type.weeklyCapDays}/Woche` : ""}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meine Anträge</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Anträge gestellt.</p>}
          {requests.map((request) => {
            const canCancel = (request.status === "PENDING" || request.status === "APPROVED") && request.endDate >= today;
            return (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <AbsenceTypeIcon icon={request.absenceType.icon} color={request.absenceType.color} />
                  <div>
                    <p className="font-medium">{request.absenceType.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.startDate.toLocaleDateString("de-DE")} – {request.endDate.toLocaleDateString("de-DE")} ({request.days} Tage)
                    </p>
                    {request.note && <p className="text-xs text-muted-foreground">„{request.note}“</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[request.status]}>{STATUS_LABELS[request.status]}</Badge>
                  {canCancel && <CancelRequestButton requestId={request.id} />}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
