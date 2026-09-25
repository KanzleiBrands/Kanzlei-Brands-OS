import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { computeOverviewStats, computeCampaignCardStats, computeDealVolumeStats } from "@/lib/dashboard-stats";
import { StatTile } from "@/components/stat-tile";
import { getBaseUrl } from "@/lib/base-url";
import { getClientReadiness } from "@/lib/client-readiness";
import { CampaignsTab } from "./campaigns-tab";
import { SettingsTab, SETTINGS_SUBTAB_VALUES, type SettingsSubTab } from "./settings-tab";
import { ClientLogTab } from "./client-log-tab";
import { ContentTab } from "./content-tab";
import { ReactivateOrganizationButton } from "./reactivate-organization-button";
import { PartnerProgramTab } from "./partner-program-tab";
import { getPartnerPointsBalance } from "@/lib/actions/partner-program";

type Tab = "overview" | "jobs" | "leads" | "content" | "settings" | "log" | "partner";

const TAB_ORDER: { value: Tab; label: string }[] = [
  { value: "overview", label: "Übersicht" },
  { value: "jobs", label: "Stellenanzeigen" },
  { value: "leads", label: "Mandatsakquise" },
  { value: "content", label: "Social Media Content" },
  { value: "partner", label: "Partnerprogramm" },
  { value: "settings", label: "Kundeneinstellungen" },
  { value: "log", label: "Kunden-Log" },
];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string; subtab?: string }>;
}) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const { tab: tabParam, subtab: subtabParam } = await searchParams;
  const tab: Tab =
    tabParam === "settings" ||
    tabParam === "jobs" ||
    tabParam === "leads" ||
    tabParam === "log" ||
    tabParam === "content" ||
    tabParam === "partner"
      ? tabParam
      : "overview";
  const settingsSubTab: SettingsSubTab = SETTINGS_SUBTAB_VALUES.includes(subtabParam as SettingsSubTab)
    ? (subtabParam as SettingsSubTab)
    : "general";

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      users: { orderBy: { createdAt: "asc" }, include: { pipelineAccess: true } },
      pipelines: {
        orderBy: { createdAt: "asc" },
        include: {
          stages: { select: { id: true, name: true, order: true, color: true, isRejected: true, isFinal: true } },
          contacts: { select: { id: true, stageId: true, createdAt: true, updatedAt: true, dealVolumeEur: true } },
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
  const dealVolumeStats = computeDealVolumeStats(leadPipelines);
  const eurFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
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
    tab === "settings" || tab === "content"
      ? await prisma.user.findMany({
          where: { role: "AGENCY_ADMIN", organizationId: session.user.organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];
  const socialChannels =
    tab === "content"
      ? await prisma.socialChannel.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })
      : [];
  const socialPosts =
    tab === "content"
      ? await prisma.socialPost.findMany({
          where: { organizationId: orgId },
          include: { responsible: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const socialComments =
    tab === "content"
      ? await prisma.socialComment.findMany({
          where: { post: { organizationId: orgId } },
          orderBy: { postedAt: "asc" },
        })
      : [];
  const inviteReadiness = tab === "settings" ? await getClientReadiness(organization.id) : { ready: true, missing: [] };
  const auditEntries =
    tab === "log"
      ? await prisma.auditLog.findMany({
          where: { organizationId: organization.id },
          include: { user: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];
  const availableProductTags =
    tab === "settings"
      ? (
          await prisma.offer.findMany({
            where: { productTag: { not: null } },
            select: { productTag: true },
            distinct: ["productTag"],
            orderBy: { productTag: "asc" },
          })
        ).map((o) => o.productTag!)
      : [];
  const partnerData =
    tab === "partner"
      ? await (async () => {
          const [balance, partnerActions, transactions] = await Promise.all([
            getPartnerPointsBalance(organization.id),
            prisma.partnerAction.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
            prisma.partnerPointsTransaction.findMany({
              where: { organizationId: organization.id },
              include: { action: { select: { title: true } }, reward: { select: { title: true } }, user: { select: { name: true } } },
              orderBy: { createdAt: "desc" },
              take: 50,
            }),
          ]);
          return { balance, partnerActions, transactions };
        })()
      : null;

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

      <div className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TAB_ORDER.map((item) => (
          <Link
            key={item.value}
            href={`/dashboard/clients/${organization.id}?tab=${item.value}`}
            className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === item.value ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <StatTile
                  label="Dealvolumen (30 Tage)"
                  value={eurFormatter.format(dealVolumeStats.last30DaysEur)}
                  subtext={`${eurFormatter.format(dealVolumeStats.totalEur)} gesamt`}
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
          subTab={settingsSubTab}
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
          backofficeContactId={organization.backofficeContactId}
          leadsFormUrl={organization.leadsFormUrl}
          applicantsFormUrl={organization.applicantsFormUrl}
          agencyUsers={agencyUsers}
          monthlyReportEnabled={organization.monthlyReportEnabled}
          applicantDataRetentionMonths={organization.applicantDataRetentionMonths}
          leadDataRetentionMonths={organization.leadDataRetentionMonths}
          driveFolderUrl={organization.driveFolderUrl}
          landingPageUrl={organization.landingPageUrl}
          metaAdLibraryUrl={organization.metaAdLibraryUrl}
          linkedInAdLibraryUrl={organization.linkedInAdLibraryUrl}
          bookedProductTags={organization.bookedProductTags}
          availableProductTags={availableProductTags}
          activeApplicantChannels={organization.activeApplicantChannels}
          activeLeadChannels={organization.activeLeadChannels}
          jobsBooked={jobsBooked}
          leadsBooked={leadsBooked}
          inviteReadiness={inviteReadiness}
        />
      )}

      {tab === "content" && (
        <ContentTab
          organizationId={organization.id}
          channels={socialChannels}
          pipelines={organization.pipelines.map((p) => ({ id: p.id, name: p.name }))}
          agencyUsers={agencyUsers}
          posts={socialPosts.map((post) => ({
            id: post.id,
            platform: post.platform,
            status: post.status,
            caption: post.caption,
            mediaUrl: post.mediaUrl,
            mediaUrls: post.mediaUrls,
            mediaType: post.mediaType,
            utmCampaign: post.utmCampaign,
            channelId: post.channelId,
            pipelineId: post.pipelineId,
            responsibleUserId: post.responsibleUserId,
            responsibleName: post.responsible?.name ?? null,
            scheduledAt: post.scheduledAt?.toISOString() ?? null,
            publishedAt: post.publishedAt?.toISOString() ?? null,
            publishedUrl: post.publishedUrl,
            clientFeedback: post.clientFeedback,
            publishError: post.publishError,
          }))}
          comments={socialComments.map((comment) => ({
            id: comment.id,
            postId: comment.postId,
            authorName: comment.authorName,
            authorAvatarUrl: comment.authorAvatarUrl,
            message: comment.message,
            isHidden: comment.isHidden,
            isOwnReply: comment.isOwnReply,
            parentCommentId: comment.parentCommentId,
            postedAt: comment.postedAt.toISOString(),
          }))}
          analyticsPosts={socialPosts
            .filter((post) => post.status === "PUBLISHED" && post.publishedAt)
            .map((post) => ({
              id: post.id,
              platform: post.platform,
              caption: post.caption,
              publishedAt: post.publishedAt!.toISOString(),
              publishedUrl: post.publishedUrl,
              reach: post.reach,
              likeCount: post.likeCount,
              commentCount: post.commentCount,
              shareCount: post.shareCount,
              clickCount: post.clickCount,
            }))}
        />
      )}

      {tab === "log" && <ClientLogTab users={organization.users} entries={auditEntries} />}

      {tab === "partner" && partnerData && (
        <PartnerProgramTab
          organizationId={organization.id}
          balance={partnerData.balance}
          actions={partnerData.partnerActions.map((a) => ({ id: a.id, title: a.title, points: a.points }))}
          transactions={partnerData.transactions.map((t) => ({
            id: t.id,
            kind: t.kind,
            points: t.points,
            note: t.note,
            actionTitle: t.action?.title ?? null,
            rewardTitle: t.reward?.title ?? null,
            userName: t.user?.name ?? null,
            createdAt: t.createdAt.toLocaleString("de-DE"),
          }))}
        />
      )}
    </div>
  );
}
