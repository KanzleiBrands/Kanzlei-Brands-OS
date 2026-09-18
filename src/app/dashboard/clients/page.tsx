import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeOverviewStats } from "@/lib/dashboard-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewClientForm } from "./new-client-form";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const clients = await prisma.organization.findMany({
    where: { type: "CLIENT", parentId: session.user.organizationId },
    include: {
      _count: { select: { users: true, pipelines: true } },
      pipelines: {
        select: {
          id: true,
          name: true,
          active: true,
          stages: { select: { id: true, name: true, order: true, color: true } },
          contacts: { select: { id: true, stageId: true, createdAt: true, updatedAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kunden</h1>
        <NewClientForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle Kunden</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Aktive Kampagnen</TableHead>
                <TableHead>Kontakte</TableHead>
                <TableHead>Neu</TableHead>
                <TableHead>Offen über 2 Tage</TableHead>
                <TableHead>Letzter Eingang</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const stats = computeOverviewStats(client.pipelines);
                const activeCampaigns = client.pipelines.filter((p) => p.active).length;
                const lastContact = client.pipelines
                  .flatMap((p) => p.contacts)
                  .reduce<Date | null>((latest, c) => (!latest || c.createdAt > latest ? c.createdAt : latest), null);

                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      {activeCampaigns} / {client._count.pipelines}
                    </TableCell>
                    <TableCell>{stats.totalContacts}</TableCell>
                    <TableCell>
                      {stats.newLast7Days > 0 ? <Badge>{stats.newLast7Days}</Badge> : stats.newLast7Days}
                    </TableCell>
                    <TableCell>
                      {stats.staleUnprocessed > 0 ? (
                        <Badge variant="destructive">{stats.staleUnprocessed}</Badge>
                      ) : (
                        stats.staleUnprocessed
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastContact ? lastContact.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "-"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/clients/${client.id}`} className="text-sm underline">
                        Portal öffnen →
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Noch keine Kunden angelegt.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
