import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { isAgencyMarketingStaffFor } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getAccountJourney } from "@/lib/attribution/stats";
import { PLATFORM_LABELS, JOURNEY_EVENT_LABELS } from "@/lib/attribution/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftIcon, MousePointerClickIcon, FlagIcon } from "lucide-react";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateTimeFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Candidate Journey - vollständiger Zeitstrahl aller Touchpoints + Meilensteine über alle Personen einer Kanzlei hinweg. */
export default async function CandidateJourneyPage({ params }: { params: Promise<{ accountId: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { accountId } = await params;
  const account = await prisma.candidateAccount.findUnique({ where: { id: accountId }, select: { organizationId: true } });
  if (!account) notFound();

  const canManage = session.user.role === "AGENCY_ADMIN" || (await isAgencyMarketingStaffFor(session, account.organizationId));
  if (!canManage) redirect("/dashboard/intern");

  const journey = await getAccountJourney(accountId);
  if (!journey) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/intern/marketing/campaigns" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Zurück zu Kampagnen
      </Link>

      <div>
        <h2 className="text-lg font-semibold">{journey.name ?? journey.domain ?? "Unbekannte Kanzlei"}</h2>
        <p className="text-sm text-muted-foreground">
          {journey.candidates.map((c) => c.name ?? c.email).join(", ")}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Journey</CardTitle></CardHeader>
        <CardContent>
          {journey.timeline.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Touchpoints oder Meilensteine erfasst.</p>}
          <div className="flex flex-col gap-3">
            {journey.timeline.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${item.kind === "event" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {item.kind === "event" ? <FlagIcon className="size-3.5" /> : <MousePointerClickIcon className="size-3.5" />}
                  </div>
                  {i < journey.timeline.length - 1 && <div className="w-px flex-1 bg-foreground/10" />}
                </div>
                <div className="flex-1 pb-3">
                  <p className="text-xs text-muted-foreground">{dateTimeFmt.format(item.occurredAt)}</p>
                  {item.kind === "touchpoint" ? (
                    <p className="text-sm">
                      Touchpoint über <span className="font-medium">{PLATFORM_LABELS[item.platform]}</span>
                      {item.campaignName && <> - Kampagne &quot;{item.campaignName}&quot;</>}
                      {item.creativeName && <> - Creative &quot;{item.creativeName}&quot;</>}
                    </p>
                  ) : (
                    <p className="text-sm font-medium">
                      {JOURNEY_EVENT_LABELS[item.type as keyof typeof JOURNEY_EVENT_LABELS] ?? item.type}
                      {item.dealValue != null && <> - {eur.format(item.dealValue)}</>}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
