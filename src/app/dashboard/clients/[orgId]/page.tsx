import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeOverviewStats, computeCampaignCardStats } from "@/lib/dashboard-stats";
import { StatTile } from "@/components/stat-tile";
import { getBaseUrl } from "@/lib/base-url";
import { CampaignsTab } from "./campaigns-tab";
import { SettingsTab } from "./settings-tab";

type Tab = "campaigns" | "settings";

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
  const tab: Tab = tabParam === "settings" ? "settings" : "campaigns";

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

  const stats = computeOverviewStats(organization.pipelines);
  const baseUrl = await getBaseUrl();
  const courses = await prisma.course.findMany({ orderBy: { createdAt: "desc" } });
  const assignedCourseIds = new Set(organization.courseAssignments.map((a) => a.courseId));

  const campaigns = organization.pipelines.map((pipeline) => {
    const cardStats = computeCampaignCardStats(pipeline);
    return {
      id: pipeline.id,
      name: pipeline.name,
      kind: pipeline.kind,
      totalContacts: cardStats.totalContacts,
      unprocessed: cardStats.unprocessed,
      staleUnprocessed: cardStats.staleUnprocessed,
      lastLeadAt: cardStats.lastLeadAt?.toISOString() ?? null,
      lastChangeAt: cardStats.lastChangeAt?.toISOString() ?? null,
    };
  });

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
        <Link href={`/dashboard/audit-log?orgId=${organization.id}`} className="text-sm text-muted-foreground underline">
          Audit-Log ansehen →
        </Link>
      </div>

      <div className="mb-6 flex gap-1 border-b">
        <Link
          href={`/dashboard/clients/${organization.id}?tab=campaigns`}
          className={`border-b-2 px-3 py-2 text-sm ${tab === "campaigns" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Kampagnen
        </Link>
        <Link
          href={`/dashboard/clients/${organization.id}?tab=settings`}
          className={`border-b-2 px-3 py-2 text-sm ${tab === "settings" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Kundeneinstellungen
        </Link>
      </div>

      {tab === "campaigns" && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Neu in 7 Tagen"
              value={stats.newLast7Days}
              subtext={`${stats.totalContacts} Kontakte gesamt`}
            />
            <StatTile
              label="Unbearbeitet"
              value={stats.unprocessed}
              subtext={`${stats.staleUnprocessed} seit über 2 Tagen offen`}
            />
            <StatTile label="In Bearbeitung" value={stats.inProgress} subtext="aktuell in Bearbeitung" />
            <StatTile
              label="Abgeschlossen in 30 Tagen"
              value={stats.completedLast30Days}
              subtext={`${stats.completedTotal} gesamt`}
            />
          </div>

          <CampaignsTab organizationId={organization.id} campaigns={campaigns} />
        </>
      )}

      {tab === "settings" && (
        <SettingsTab
          organizationId={organization.id}
          organizationName={organization.name}
          users={organization.users}
          pipelines={organization.pipelines}
          courses={courses}
          assignedCourseIds={assignedCourseIds}
          baseUrl={baseUrl}
        />
      )}
    </div>
  );
}
