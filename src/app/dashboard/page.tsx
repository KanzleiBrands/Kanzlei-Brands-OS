import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { accessiblePipelineIds } from "@/lib/access";
import { computeOverviewStats, computeDealVolumeStats } from "@/lib/dashboard-stats";
import { avatarColorFor, initialsOf } from "@/lib/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";
import { PotentialScoreCard } from "./potential-score-card";
import {
  APPLICANT_GROWTH_LEVERS,
  LEAD_GROWTH_LEVERS,
  APPLICANT_GENERIC_TIPS,
  LEAD_GENERIC_TIPS,
  computeGrowthScore,
} from "@/lib/growth-levers";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  // Agency admins land on the richer Kunden-Übersicht instead of this page.
  if (session.user.role === "AGENCY_ADMIN") redirect("/dashboard/clients");

  const accessible =
    session.user.role === "CLIENT_STAFF" ? await accessiblePipelineIds(session, session.user.organizationId) : "ALL";

  const pipelineFilter = {
    organizationId: session.user.organizationId,
    ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
  };

  const pipelines = await prisma.pipeline.findMany({
    where: pipelineFilter,
    include: {
      stages: { orderBy: { order: "asc" } },
      contacts: {
        select: { id: true, stageId: true, createdAt: true, updatedAt: true, dealVolumeEur: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const stats = computeOverviewStats(pipelines);
  const leadPipelines = pipelines.filter((p) => p.kind === "LEADS");
  const dealVolumeStats = computeDealVolumeStats(leadPipelines);
  const eurFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const recentContacts = await prisma.contact.findMany({
    where: { pipeline: pipelineFilter },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { stage: true, pipeline: { select: { name: true } } },
  });

  // Potenzialscore: org-weit (nicht auf accessible Pipelines beschränkt), da
  // Kontingente/Kanäle organisationsweit gelten, unabhängig vom Zugriff
  // dieses einzelnen Mitarbeiters.
  const organization = await prisma.organization.findUnique({ where: { id: session.user.organizationId } });
  const allOrgPipelines = await prisma.pipeline.findMany({
    where: { organizationId: session.user.organizationId },
    select: { kind: true },
  });
  const orgLeadsUsed = allOrgPipelines.filter((p) => p.kind === "LEADS").length;
  const orgApplicantsUsed = allOrgPipelines.filter((p) => p.kind === "APPLICANTS").length;
  const jobsBooked = organization !== null && (organization.applicantsQuota !== null || orgApplicantsUsed > 0);
  const leadsBooked = organization !== null && (organization.leadsQuota !== null || orgLeadsUsed > 0);
  const applicantScore = organization
    ? computeGrowthScore(APPLICANT_GROWTH_LEVERS, organization.activeApplicantChannels, organization.bookedProductTags)
    : null;
  const leadScore = organization
    ? computeGrowthScore(LEAD_GROWTH_LEVERS, organization.activeLeadChannels, organization.bookedProductTags)
    : null;

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Übersicht</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Neu in 30 Tagen"
          value={stats.newLast30Days}
          subtext={`${stats.totalContacts} Kontakte gesamt`}
        />
        <StatTile
          label="Unbearbeitet"
          value={stats.unprocessed}
          subtext={`${stats.staleUnprocessed} seit über 3 Tagen offen`}
        />
        <StatTile label="In Bearbeitung" value={stats.inProgress} subtext="aktuell in Bearbeitung" />
        <StatTile
          label="Abgeschlossen in 12 Monaten"
          value={stats.completedLast365Days}
          subtext={`${stats.completedTotal} gesamt`}
        />
        {leadPipelines.length > 0 && (
          <StatTile
            label="Dealvolumen (30 Tage)"
            value={eurFormatter.format(dealVolumeStats.last30DaysEur)}
            subtext={`${eurFormatter.format(dealVolumeStats.totalEur)} gesamt`}
          />
        )}
      </div>

      {(jobsBooked || leadsBooked) && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Dein Potenzialscore</h2>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {jobsBooked && applicantScore && (
              <PotentialScoreCard
                title="Recruiting-Kampagne"
                percent={applicantScore.percent}
                unmetLevers={applicantScore.unmetLevers}
                genericTips={APPLICANT_GENERIC_TIPS}
              />
            )}
            {leadsBooked && leadScore && (
              <PotentialScoreCard
                title="Mandatsakquise-Kampagne"
                percent={leadScore.percent}
                unmetLevers={leadScore.unmetLevers}
                genericTips={LEAD_GENERIC_TIPS}
              />
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Kampagnen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {pipelines.map((pipeline) => {
              const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
              const firstStageId = sortedStages[0]?.id;
              const newCount = pipeline.contacts.filter((c) => c.stageId === firstStageId).length;
              const lastContact = pipeline.contacts.reduce<Date | null>(
                (latest, c) => (!latest || c.createdAt > latest ? c.createdAt : latest),
                null,
              );
              return (
                <Link
                  key={pipeline.id}
                  href={`/dashboard/pipelines/${pipeline.id}`}
                  className="flex items-center justify-between rounded px-2 py-2 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: sortedStages[0]?.color ?? "var(--muted-foreground)" }}
                    />
                    <div>
                      <p className="font-medium">{pipeline.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {lastContact
                          ? `Letzter Eingang ${lastContact.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`
                          : "Noch keine Eingänge"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!pipeline.active ? (
                      <Badge variant="outline">Pausiert</Badge>
                    ) : newCount > 0 ? (
                      <Badge>{newCount} neu</Badge>
                    ) : null}
                    <span className="text-sm text-muted-foreground">{pipeline.contacts.length}</span>
                  </div>
                </Link>
              );
            })}
            {pipelines.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kampagnen.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neueste Kontakte</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentContacts.map((contact) => {
              const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unbenannt";
              return (
                <Link
                  key={contact.id}
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: avatarColorFor(fullName) }}
                    >
                      {initialsOf(contact.firstName, contact.lastName)}
                    </span>
                    <div className="overflow-hidden">
                      <p className="truncate text-sm font-medium">{fullName}</p>
                      <p className="truncate text-sm text-muted-foreground">{contact.pipeline.name}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {contact.stage.name}
                  </Badge>
                </Link>
              );
            })}
            {recentContacts.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kontakte.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
