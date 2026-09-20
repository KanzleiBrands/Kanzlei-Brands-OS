import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Kunde angelegt",
  "user.created": "Nutzer angelegt",
  "pipeline.created": "Kampagne angelegt",
  "pipeline.deleted": "Kampagne gelöscht",
  "pipeline_access.granted": "Kampagnen-Zugriff gewährt",
  "pipeline_access.revoked": "Kampagnen-Zugriff entzogen",
  "contact.deleted": "Kontakt gelöscht",
  "contacts.csv_imported": "Kontakte per CSV importiert",
  "user.activated": "Zugang aktiviert",
  "user.deleted": "Mitarbeiter gelöscht",
  "organization.archived": "Kunde archiviert",
  "organization.reactivated": "Kunde reaktiviert",
  "organization.renamed": "Kunde umbenannt",
  "pipeline.renamed": "Kampagne umbenannt",
  "contact.stage_changed": "Kontakt-Status geändert",
  "contact.viewed": "Kontakt angesehen",
  "offer_interest.created": "Interesse an Angebot bekundet",
  "user.password_changed": "Passwort geändert",
  "user.email_changed": "E-Mail geändert",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  // Internal to the agency only — clients never see the audit log.
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const { orgId } = await searchParams;
  const scopedOrg = orgId ? await prisma.organization.findUnique({ where: { id: orgId } }) : null;

  const entries = await prisma.auditLog.findMany({
    where: scopedOrg ? { organizationId: scopedOrg.id } : {},
    include: { user: true, organization: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Audit-Log{scopedOrg ? ` – ${scopedOrg.name}` : ""}</h1>
      <p className="mb-6 text-muted-foreground">
        Nachvollziehbarkeit für DSGVO-Zwecke: wer hat wann welche Aktion durchgeführt.
      </p>
      {scopedOrg && (
        <div className="mb-4">
          <BackLink href="/dashboard/audit-log">Alle Kunden anzeigen</BackLink>
        </div>
      )}

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
                {!scopedOrg && <TableHead>Organisation</TableHead>}
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
                  {!scopedOrg && <TableCell>{entry.organization.name}</TableCell>}
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
