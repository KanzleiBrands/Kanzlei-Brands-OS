import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { computeOverviewStats } from "@/lib/dashboard-stats";
import { StatTile } from "@/components/stat-tile";
import { StatusDistributionBar } from "@/components/status-distribution-bar";
import { NewUserForm } from "./new-user-form";
import { NewPipelineForm } from "./new-pipeline-form";
import { PipelineAccessToggle } from "./pipeline-access-toggle";
import { NewOfferForm } from "./new-offer-form";
import { OfferActiveToggle } from "./offer-active-toggle";

export default async function ClientDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

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
      offers: { orderBy: { createdAt: "desc" }, include: { interests: { include: { user: true } } } },
    },
  });

  if (!organization || organization.type !== "CLIENT") notFound();

  const staff = organization.users.filter((u) => u.role === "CLIENT_STAFF");
  const stats = computeOverviewStats(organization.pipelines);

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold">{organization.name}</h1>
      <p className="mb-6 text-muted-foreground">Kunden-Portal (Agentur-Ansicht)</p>

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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statusverteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusDistributionBar segments={stats.statusDistribution} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Mitarbeiter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewUserForm organizationId={organization.id} canAssignAdmin />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Pipeline-Zugriff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "CLIENT_ADMIN" ? "default" : "secondary"}>
                      {user.role === "CLIENT_ADMIN" ? "Admin" : "Mitarbeiter"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === "CLIENT_STAFF" ? (
                      <div className="flex flex-wrap gap-3">
                        {organization.pipelines.map((pipeline) => {
                          const granted = user.pipelineAccess.some((a) => a.pipelineId === pipeline.id);
                          return (
                            <label key={pipeline.id} className="flex items-center gap-1 text-sm">
                              <PipelineAccessToggle userId={user.id} pipelineId={pipeline.id} granted={granted} />
                              {pipeline.name}
                            </label>
                          );
                        })}
                        {organization.pipelines.length === 0 && (
                          <span className="text-sm text-muted-foreground">Keine Pipelines vorhanden</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Voller Zugriff (Admin)</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pipelines / Kampagnen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewPipelineForm organizationId={organization.id} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.pipelines.map((pipeline) => (
                <TableRow key={pipeline.id}>
                  <TableCell className="font-medium">{pipeline.name}</TableCell>
                  <TableCell>{pipeline.kind === "LEADS" ? "Leads (CRM)" : "Bewerber (ATS)"}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/pipelines/${pipeline.id}`} className="text-sm underline">
                      Öffnen
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {organization.pipelines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Noch keine Pipelines.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Kunden-Hub / Angebote</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewOfferForm organizationId={organization.id} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interesse bekundet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.title}</TableCell>
                  <TableCell>
                    <OfferActiveToggle offerId={offer.id} active={offer.active} />
                  </TableCell>
                  <TableCell>
                    {offer.interests.length === 0
                      ? "Noch niemand"
                      : offer.interests.map((i) => i.user.name).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
              {organization.offers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Noch keine Angebote.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {staff.length} Mitarbeiter · {organization.pipelines.length} Pipelines · {organization.offers.length} Angebote im Kunden-Hub
      </p>
    </div>
  );
}
