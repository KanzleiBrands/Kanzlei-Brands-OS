import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeOverviewStats } from "@/lib/dashboard-stats";
import { NewClientForm } from "./new-client-form";
import { ClientsTable } from "./clients-table";

const DAY_MS = 86_400_000;

function countWithin30Days(dates: Date[]) {
  const now = Date.now();
  return dates.filter((date) => now - date.getTime() <= 30 * DAY_MS).length;
}

function trendCard(label: string, value: number, deltaLast30Days: number) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        {deltaLast30Days > 0 && <span className="text-sm font-medium text-emerald-500">↗</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">+{deltaLast30Days} in 30 Tagen</p>
    </div>
  );
}

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const clients = await prisma.organization.findMany({
    where: { type: "CLIENT", parentId: session.user.organizationId },
    include: {
      pipelines: {
        select: {
          id: true,
          name: true,
          active: true,
          createdAt: true,
          stages: { select: { id: true, name: true, order: true, color: true } },
          contacts: { select: { id: true, stageId: true, createdAt: true, updatedAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const clientsLast30Days = countWithin30Days(clients.map((c) => c.createdAt));
  const allPipelines = clients.flatMap((c) => c.pipelines);
  const campaignsLast30Days = countWithin30Days(allPipelines.map((p) => p.createdAt));
  const allContacts = allPipelines.flatMap((p) => p.contacts);
  const leadsLast30Days = countWithin30Days(allContacts.map((c) => c.createdAt));

  const clientRows = clients.map((client) => {
    const stats = computeOverviewStats(client.pipelines);
    const activePipelines = client.pipelines.filter((p) => p.active).length;
    const lastLeadAt = client.pipelines
      .flatMap((p) => p.contacts)
      .reduce<Date | null>((latest, c) => (!latest || c.createdAt > latest ? c.createdAt : latest), null);

    return {
      id: client.id,
      name: client.name,
      totalContacts: stats.totalContacts,
      activePipelines,
      totalPipelines: client.pipelines.length,
      unprocessed: stats.unprocessed,
      staleUnprocessed: stats.staleUnprocessed,
      newLast7Days: stats.newLast7Days,
      lastLeadAt: lastLeadAt?.toISOString() ?? null,
    };
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Kunden-Übersicht</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {trendCard("Kunden", clients.length, clientsLast30Days)}
        {trendCard("Kampagnen", allPipelines.length, campaignsLast30Days)}
        {trendCard("Leads", allContacts.length, leadsLast30Days)}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kunden</h2>
          <p className="text-sm text-muted-foreground">Hier siehst du all deine Kunden.</p>
        </div>
        <NewClientForm />
      </div>

      <ClientsTable clients={clientRows} />
    </div>
  );
}
