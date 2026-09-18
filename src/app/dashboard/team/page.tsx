import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "../clients/[orgId]/new-user-form";
import { PipelineAccessToggle } from "../clients/[orgId]/pipeline-access-toggle";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT_ADMIN") redirect("/dashboard");

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: {
      users: { orderBy: { createdAt: "asc" }, include: { pipelineAccess: true } },
      pipelines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!organization) redirect("/dashboard");

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Mitarbeiter verwalten</h1>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewUserForm organizationId={organization.id} canAssignAdmin={false} />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Kampagnen-Zugriff</TableHead>
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
                          <span className="text-sm text-muted-foreground">Keine Kampagnen vorhanden</span>
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
    </div>
  );
}
