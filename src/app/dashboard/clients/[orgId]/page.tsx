import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeOverviewStats, computeCampaignCardStats } from "@/lib/dashboard-stats";
import { StatTile } from "@/components/stat-tile";
import { getBaseUrl } from "@/lib/base-url";
import { CampaignsTab } from "./campaigns-tab";
import { SettingsTab } from "./settings-tab";
import { ReactivateOrganizationButton } from "./reactivate-organization-button";

type Tab = "overview" | "jobs" | "leads" | "settings";

const TAB_ORDER: { value: Tab; label: string }[] = [
  { value: "overview", label: "Übersicht" },
  { value: "jobs", label: "Stellenanzeigen" },
  { value: "leads", label: "Mandatsakquise" },
  { value: "settings", label: "Kundeneinstellungen" },
];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const { tab: tabParam } = await searchParams;
  const tab: Tab =
    tabParam === "settings" || tabParam === "jobs" || tabParam === "leads" ? tabParam : "overview";

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

  const jobPipelines = organization.pipelines.filter((p) => p.kind === "APPLICANTS");
  const leadPipelines = organization.pipelines.filter((p) => p.kind === "LEADS");
  const jobsStats = computeOverviewStats(jobPipelines);
  const leadsStats = computeOverviewStats(leadPipelines);
  const baseUrl = await getBaseUrl();
  const leadsUsed = leadPipelines.length;
  const applicantsUsed = jobPipelines.length;
  const jobsBooked = organization.applicantsQuota !== null || applicantsUsed > 0;
  const leadsBooked = organization.leadsQuota !== null || leadsUsed > 0;
  const courses = await prisma.course.findMany({ orderBy: { createdAt: "desc" } });
  const stageTemplates = await prisma.stageTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const assignedCourseIds = new Set(organization.courseAssignments.map((a) => a.courseId));
  const agencyUsers =
    tab === "settings"
      ? await prisma.user.findMany({
          where: { role: "AGENCY_ADMIN", organizationId: session.user.organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  function toCampaign(pipeline: NonNullable<typeof organization>["pipelines"][number]) {
    const cardStats = computeCampaignCardStats(pipeline);
    return {
      id: pipeline.id,
      name: pipeline.name,
      location: pipeline.location,
      totalContacts: cardStats.totalContacts,
      unprocessed: cardStats.unprocessed,
      staleUnprocessed: cardStats.staleUnprocessed,
      lastLeadAt: cardStats.lastLeadAt?.toISOString() ?? null,
      lastChangeAt: cardStats.lastChangeAt?.toISOString() ?? null,
    };
  }

  const jobCampaigns = jobPipelines.map(toCampaign);
  const leadCampaigns = leadPipelines.map(toCampaign);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
        <Link href={`/dashboard/audit-log?orgId=${organization.id}`} className="text-sm text-muted-foreground underline">
          Audit-Log ansehen →
        </Link>
      </div>

      {organization.archivedAt && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
          <p className="text-sm">Dieser Kunde ist archiviert und in der Kunden-Übersicht ausgeblendet.</p>
          <ReactivateOrganizationButton organizationId={organization.id} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-1 border-b">
        {TAB_ORDER.map((item) => (
          <Link
            key={item.value}
            href={`/dashboard/clients/${organization.id}?tab=${item.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${tab === item.value ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Stellenanzeigen</h2>
            {jobsBooked ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Neu in 30 Tagen"
                  value={jobsStats.newLast30Days}
                  subtext={`${jobsStats.totalContacts} Kontakte gesamt`}
                />
                <StatTile
                  label="Unbearbeitet"
                  value={jobsStats.unprocessed}
                  subtext={`${jobsStats.staleUnprocessed} seit über 3 Tagen offen`}
                />
                <StatTile label="In Bearbeitung" value={jobsStats.inProgress} subtext="aktuell in Bearbeitung" />
                <StatTile
                  label="Eingestellt in 12 Monaten"
                  value={jobsStats.completedLast365Days}
                  subtext={`${jobsStats.completedTotal} gesamt`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Stellenanzeigen sind für diesen Kunden nicht gebucht.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Mandatsakquise</h2>
            {leadsBooked ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Neu in 30 Tagen"
                  value={leadsStats.newLast30Days}
                  subtext={`${leadsStats.totalContacts} Kontakte gesamt`}
                />
                <StatTile
                  label="Unbearbeitet"
                  value={leadsStats.unprocessed}
                  subtext={`${leadsStats.staleUnprocessed} seit über 3 Tagen offen`}
                />
                <StatTile label="In Bearbeitung" value={leadsStats.inProgress} subtext="aktuell in Bearbeitung" />
                <StatTile
                  label="Abgeschlossen in 12 Monaten"
                  value={leadsStats.completedLast365Days}
                  subtext={`${leadsStats.completedTotal} gesamt`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Mandatsakquise ist für diesen Kunden nicht gebucht.</p>
            )}
          </section>
        </div>
      )}

      {tab === "jobs" && (
        <CampaignsTab
          organizationId={organization.id}
          kind="APPLICANTS"
          campaigns={jobCampaigns}
          templates={stageTemplates}
          quota={organization.applicantsQuota}
          used={applicantsUsed}
          booked={jobsBooked}
        />
      )}

      {tab === "leads" && (
        <CampaignsTab
          organizationId={organization.id}
          kind="LEADS"
          campaigns={leadCampaigns}
          templates={stageTemplates}
          quota={organization.leadsQuota}
          used={leadsUsed}
          booked={leadsBooked}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          organizationId={organization.id}
          organizationName={organization.name}
          archivedAt={organization.archivedAt}
          users={organization.users}
          pipelines={organization.pipelines}
          courses={courses}
          assignedCourseIds={assignedCourseIds}
          baseUrl={baseUrl}
          leadsQuota={organization.leadsQuota}
          applicantsQuota={organization.applicantsQuota}
          leadsUsed={leadsUsed}
          applicantsUsed={applicantsUsed}
          accountManagerId={organization.accountManagerId}
          leadsFormUrl={organization.leadsFormUrl}
          applicantsFormUrl={organization.applicantsFormUrl}
          agencyUsers={agencyUsers}
          monthlyReportEnabled={organization.monthlyReportEnabled}
          rejectedDataRetentionMonths={organization.rejectedDataRetentionMonths}
        />
      )}
    </div>
  );
}
