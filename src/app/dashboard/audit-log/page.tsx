import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Kunde angelegt",
  "user.created": "Nutzer angelegt",
  "pipeline.created": "Pipeline angelegt",
  "pipeline_access.granted": "Pipeline-Zugriff gewährt",
  "pipeline_access.revoked": "Pipeline-Zugriff entzogen",
  "contact.stage_changed": "Kontakt-Status geändert",
  "contact.viewed": "Kontakt angesehen",
  "offer_interest.created": "Interesse an Angebot bekundet",
};

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT_STAFF") redirect("/dashboard");

  const entries = await prisma.auditLog.findMany({
    where: session.user.role === "AGENCY_ADMIN" ? {} : { organizationId: session.user.organizationId },
    include: { user: true, organization: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-semibold">Audit-Log</h1>
      <p className="mb-6 text-muted-foreground">
        Nachvollziehbarkeit für DSGVO-Zwecke: wer hat wann welche Aktion durchgeführt.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Letzte 100 Einträge</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Nutzer</TableHead>
                {session.user.role === "AGENCY_ADMIN" && <TableHead>Organisation</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {entry.createdAt.toLocaleString("de-DE")}
                  </TableCell>
                  <TableCell>{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
                  <TableCell>{entry.user?.name ?? "System"}</TableCell>
                  {session.user.role === "AGENCY_ADMIN" && <TableCell>{entry.organization.name}</TableCell>}
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Noch keine Einträge.
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
