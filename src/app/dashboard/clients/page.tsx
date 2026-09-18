import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewClientForm } from "./new-client-form";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const clients = await prisma.organization.findMany({
    where: { type: "CLIENT", parentId: session.user.organizationId },
    include: { _count: { select: { users: true, pipelines: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Kunden</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Neuen Kunden anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          <NewClientForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle Kunden</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mitarbeiter</TableHead>
                <TableHead>Pipelines</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client._count.users}</TableCell>
                  <TableCell>{client._count.pipelines}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/clients/${client.id}`} className="text-sm underline">
                      Verwalten
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
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
