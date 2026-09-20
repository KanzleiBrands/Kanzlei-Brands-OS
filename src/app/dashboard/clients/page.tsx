import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { computeOverviewStats, computeCompletedStats, computeDealVolumeStats } from "@/lib/dashboard-stats";
import { NewClientForm } from "./new-client-form";
import { ClientsTable } from "./clients-table";
import { ArchivedClientsList } from "./archived-clients-list";

const DAY_MS = 86_400_000;

type Tab = "active" | "inactive";

function countWithin30Days(dates: Date[]) {
  const now = Date.now();
  return dates.filter((date) => now - date.getTime() <= 30 * DAY_MS).length;
}

function trendCard(label: string, value: number, deltaLast30Days: number) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold">{value}</span>
        {deltaLast30Days > 0 && <span className="text-sm font-medium text-emerald-500">↗ +{deltaLast30Days}</span>}
      </div>
    </div>
  );
}

function currencyTrendCard(label: string, valueLabel: string, deltaLabel: string | null) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold">{valueLabel}</span>
        {deltaLabel && <span className="text-sm font-medium text-emerald-500">↗ +{deltaLabel}</span>}
      </div>
    </div>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "inactive" ? "inactive" : "active";

  const [clients, archivedClients] = await Promise.all([
    prisma.organization.findMany({
      where: { type: "CLIENT", parentId: session.user.organizationId, archivedAt: null },
      include: {
        pipelines: {
          select: {
            id: true,
            name: true,
            kind: true,
            active: true,
            createdAt: true,
            stages: { select: { id: true, name: true, order: true, color: true, isRejected: true, isFinal: true } },
            contacts: { select: { id: true, stageId: true, createdAt: true, updatedAt: true, dealVolumeEur: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.findMany({
      where: { type: "CLIENT", parentId: session.user.organizationId, archivedAt: { not: null } },
      select: { id: true, name: true, archivedAt: true },
      orderBy: { archivedAt: "desc" },
    }),
  ]);

  const clientsLast30Days = countWithin30Days(clients.map((c) => c.createdAt));
  const allPipelines = clients.flatMap((c) => c.pipelines);
  const jobPipelines = allPipelines.filter((p) => p.kind === "APPLICANTS");
  const leadPipelines = allPipelines.filter((p) => p.kind === "LEADS");
  const jobsStats = computeOverviewStats(jobPipelines);
  const leadsStats = computeOverviewStats(leadPipelines);
  const jobsCompleted = computeCompletedStats(jobPipelines);
  const leadsCompleted = computeCompletedStats(leadPipelines);
  const dealVolume = computeDealVolumeStats(leadPipelines);
  const eurFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  function lastCreatedAt(contacts: { createdAt: Date }[]) {
    return contacts.reduce<Date | null>((latest, c) => (!latest || c.createdAt > latest ? c.createdAt : latest), null);
  }

  const clientRows = clients.map((client) => {
    const jobPipelinesForClient = client.pipelines.filter((p) => p.kind === "APPLICANTS");
    const leadPipelinesForClient = client.pipelines.filter((p) => p.kind === "LEADS");
    const jobContacts = jobPipelinesForClient.flatMap((p) => p.contacts);
    const leadContacts = leadPipelinesForClient.flatMap((p) => p.contacts);
    const stats = computeOverviewStats(client.pipelines);

    return {
      id: client.id,
      name: client.name,
      totalContacts: stats.totalContacts,
      unprocessed: stats.unprocessed,
      staleUnprocessed: stats.staleUnprocessed,
      newLast7Days: stats.newLast7Days,
      applicantsTotalContacts: jobContacts.length,
      leadsTotalContacts: leadContacts.length,
      lastApplicantAt: lastCreatedAt(jobContacts)?.toISOString() ?? null,
      lastLeadAt: lastCreatedAt(leadContacts)?.toISOString() ?? null,
      leadsUsed: leadPipelinesForClient.length,
      applicantsUsed: jobPipelinesForClient.length,
      leadsQuota: client.leadsQuota,
      applicantsQuota: client.applicantsQuota,
    };
  });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Kunden-Übersicht</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        {trendCard("Kunden", clients.length, clientsLast30Days)}
        {trendCard("Bewerbungen", jobsStats.totalContacts, jobsStats.newLast30Days)}
        {trendCard("Einstellungen", jobsCompleted.total, jobsCompleted.last30Days)}
        {trendCard("Mandatsanfragen", leadsStats.totalContacts, leadsStats.newLast30Days)}
        {trendCard("Abschlüsse", leadsCompleted.total, leadsCompleted.last30Days)}
        {currencyTrendCard(
          "Dealvolumen",
          eurFormatter.format(dealVolume.totalEur),
          dealVolume.last30DaysEur > 0 ? eurFormatter.format(dealVolume.last30DaysEur) : null,
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b">
        <Link
          href="/dashboard/clients?tab=active"
          className={`border-b-2 px-3 py-2 text-sm ${tab === "active" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Kunden
        </Link>
        <Link
          href="/dashboard/clients?tab=inactive"
          className={`border-b-2 px-3 py-2 text-sm ${tab === "inactive" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Inaktive Kunden{archivedClients.length > 0 ? ` (${archivedClients.length})` : ""}
        </Link>
      </div>

      {tab === "active" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Kunden</h2>
              <p className="text-sm text-muted-foreground">Hier siehst du all deine Kunden.</p>
            </div>
            <NewClientForm />
          </div>

          <ClientsTable clients={clientRows} />
        </>
      )}

      {tab === "inactive" && (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Inaktive Kunden</h2>
            <p className="text-sm text-muted-foreground">
              Archivierte Kunden. Alle Daten bleiben erhalten, du kannst sie jederzeit reaktivieren.
            </p>
          </div>
          <ArchivedClientsList clients={archivedClients} />
        </>
      )}
    </div>
  );
}
